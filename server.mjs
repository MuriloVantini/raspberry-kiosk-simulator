import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = join(rootDirectory, "public");
const env = { ...loadEnvironment(join(rootDirectory, ".env")), ...process.env };

const configuration = {
  apiBaseUrl: withoutTrailingSlash(env.M2S_API_BASE_URL ?? "http://localhost:8000"),
  deviceId: "",
  deviceToken: "",
  port: asPositiveNumber(env.KIOSK_PORT, 3333),
  pollIntervalMs: asPositiveNumber(env.POLL_INTERVAL_MS, 3000),
  heartbeatIntervalMs: asPositiveNumber(env.HEARTBEAT_INTERVAL_MS, 15000),
};

const publicHost = env.KIOSK_PUBLIC_HOST || findLanAddress();
const publicBaseUrl = withoutTrailingSlash(env.KIOSK_PUBLIC_URL || `http://${publicHost}:${configuration.port}`);
let pairing = createPairingSession();

let connection = {
  connected: false,
  lastHeartbeatAt: null,
  lastError: null,
};
let currentDeliveryId = null;
const eventClients = new Set();

function loadEnvironment(filePath) {
  if (!existsSync(filePath)) return {};

  return readFileSync(filePath, "utf8").split(/\r?\n/).reduce((values, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return values;

    const separator = trimmed.indexOf("=");
    if (separator < 1) return values;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    values[key] = rawValue.replace(/^(["'])(.*)\1$/, "$2");
    return values;
  }, {});
}

function asPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function withoutTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function findLanAddress() {
  const addresses = Object.values(networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
  return addresses.find((address) => address.startsWith("192.168."))
    ?? addresses.find((address) => address.startsWith("10."))
    ?? addresses.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address))
    ?? addresses[0]
    ?? "localhost";
}

function createPairingSession() {
  return { token: randomBytes(24).toString("hex"), authToken: null, user: null };
}

function pairingUrl() {
  return `${publicBaseUrl}/pair.html?session=${pairing.token}`;
}

function isConfigured() {
  return Boolean(configuration.deviceId && configuration.deviceToken && configuration.deviceToken !== "cole_o_connection_token_aqui");
}

function apiUrl(path) {
  return `${configuration.apiBaseUrl}${path}`;
}

async function callDeviceApi(path, options = {}) {
  if (!isConfigured()) {
    throw new Error("Este kiosk ainda não foi pareado com um dispositivo.");
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Device-Token": configuration.deviceToken,
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? `A API retornou ${response.status}.`);
  }

  return payload;
}

async function callUserApi(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(pairing.authToken ? { Authorization: `Bearer ${pairing.authToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? `A API retornou ${response.status}.`);
  return payload;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new Error("Requisição muito grande.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function requirePairingSession(body) {
  if (!body.session || body.session !== pairing.token) throw new Error("Sessão de pareamento inválida ou expirada.");
}

async function revokePairingAuth() {
  if (!pairing.authToken) return;
  try {
    await callUserApi("/api/logout", { method: "POST" });
  } catch {
    // O pareamento não deve falhar se a revogação já tiver ocorrido no backend.
  }
  pairing.authToken = null;
  pairing.user = null;
}

async function connectDevice() {
  const payload = await callDeviceApi(`/api/kiosk/devices/${configuration.deviceId}/connect`, {
    method: "POST",
    body: JSON.stringify({ simulator: true, screen: "kiosk" }),
  });

  connection = { connected: true, lastHeartbeatAt: new Date().toISOString(), lastError: null };
  publish("connection", { ...connection, device: payload.data });
  return payload.data;
}

async function heartbeat() {
  if (!isConfigured()) return;
  try {
    await callDeviceApi(`/api/kiosk/devices/${configuration.deviceId}/heartbeat`, {
      method: "POST",
      body: JSON.stringify({ metadata: { simulator: true, screen: "kiosk", local_port: configuration.port } }),
    });

    connection = { connected: true, lastHeartbeatAt: new Date().toISOString(), lastError: null };
    publish("connection", connection);
  } catch (error) {
    connection = { ...connection, connected: false, lastError: error.message };
    publish("connection", connection);
  }
}

async function pollDeliveries() {
  if (!isConfigured()) return;
  if (currentDeliveryId !== null) return;

  try {
    const payload = await callDeviceApi(`/api/kiosk/devices/${configuration.deviceId}/deliveries`);
    const [delivery] = payload.data ?? [];
    if (!delivery) return;

    currentDeliveryId = delivery.id;
    await setDeliveryStatus(delivery.id, "delivered");
    publish("alert", delivery);
  } catch (error) {
    connection = { ...connection, connected: false, lastError: error.message };
    publish("connection", connection);
  }
}

async function setDeliveryStatus(deliveryId, status) {
  return callDeviceApi(`/api/kiosk/devices/${configuration.deviceId}/deliveries/${deliveryId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

function publish(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  eventClients.forEach((client) => client.write(message));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function serveFile(requestPath, response) {
  const requestedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = normalize(join(publicDirectory, requestedPath));

  if (!filePath.startsWith(publicDirectory) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Não encontrado");
    return;
  }

  const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
  };

  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (url.pathname === "/health") {
    sendJson(response, 200, { status: "ok", configured: isConfigured(), public_url: publicBaseUrl, ...connection });
    return;
  }

  if (url.pathname === "/api/pairing" && request.method === "GET") {
    const session = url.searchParams.get("session");
    if (session && session !== pairing.token) {
      sendJson(response, 410, { message: "Sessão de pareamento expirada." });
      return;
    }
    sendJson(response, 200, { session: pairing.token, url: pairingUrl(), configured: isConfigured() });
    return;
  }

  if (url.pathname === "/pairing-qr.svg" && request.method === "GET") {
    try {
      const svg = await QRCode.toString(pairingUrl(), { type: "svg", margin: 2, width: 420, errorCorrectionLevel: "M" });
      response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" });
      response.end(svg);
    } catch (error) {
      sendJson(response, 500, { message: error.message });
    }
    return;
  }

  if (url.pathname === "/api/pair/login" && request.method === "POST") {
    try {
      const body = await readJson(request);
      requirePairingSession(body);
      await revokePairingAuth();
      const payload = await callUserApi("/api/login", {
        method: "POST",
        body: JSON.stringify({ email: body.email, password: body.password }),
      });
      pairing.authToken = payload.token;
      pairing.user = payload.user;
      const authenticatedSession = pairing.token;
      setTimeout(async () => {
        if (pairing.token !== authenticatedSession || !pairing.authToken) return;
        await revokePairingAuth();
        pairing = createPairingSession();
        publish("pairing", { url: pairingUrl() });
      }, 10 * 60 * 1000).unref();
      sendJson(response, 200, { user: payload.user });
    } catch (error) {
      sendJson(response, 401, { message: error.message });
    }
    return;
  }

  if (url.pathname === "/api/pair/devices" && request.method === "POST") {
    try {
      const body = await readJson(request);
      requirePairingSession(body);
      if (!pairing.authToken) throw new Error("Faça login para continuar.");
      const payload = await callUserApi("/api/devices");
      const devices = (payload.data ?? []).map(({ id, name, type, location, is_online }) => ({ id, name, type, location, is_online }));
      sendJson(response, 200, { data: devices });
    } catch (error) {
      sendJson(response, 401, { message: error.message });
    }
    return;
  }

  if (url.pathname === "/api/pair/select" && request.method === "POST") {
    try {
      const body = await readJson(request);
      requirePairingSession(body);
      if (!pairing.authToken) throw new Error("Faça login para continuar.");
      const payload = await callUserApi(`/api/devices/${Number(body.device_id)}`);
      const device = payload.data;
      if (!device?.id || !device?.connection_token) throw new Error("Dispositivo inválido ou sem token de conexão.");

      configuration.deviceId = String(device.id);
      configuration.deviceToken = device.connection_token;
      await connectDevice();
      await revokePairingAuth();
      sendJson(response, 200, { data: { id: device.id, name: device.name } });
      pairing = createPairingSession();
      publish("paired", { device: { id: device.id, name: device.name } });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (url.pathname === "/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    response.write(`event: connection\ndata: ${JSON.stringify(connection)}\n\n`);
    eventClients.add(response);
    request.on("close", () => eventClients.delete(response));
    return;
  }

  if (url.pathname === "/api/connect" && request.method === "POST") {
    try {
      const device = await connectDevice();
      sendJson(response, 200, { data: device });
    } catch (error) {
      connection = { ...connection, connected: false, lastError: error.message };
      sendJson(response, 502, { message: error.message });
    }
    return;
  }

  if (url.pathname === "/api/current-alert" && request.method === "GET") {
    sendJson(response, 200, { delivery_id: currentDeliveryId });
    return;
  }

  if (url.pathname === "/api/complete-alert" && request.method === "POST") {
    if (currentDeliveryId === null) {
      sendJson(response, 409, { message: "Nenhum alerta está em exibição." });
      return;
    }

    try {
      await setDeliveryStatus(currentDeliveryId, "dismissed");
      currentDeliveryId = null;
      sendJson(response, 200, { message: "Alerta concluído" });
    } catch (error) {
      sendJson(response, 502, { message: error.message });
    }
    return;
  }

  serveFile(url.pathname, response);
});

server.listen(configuration.port, "0.0.0.0", () => {
  console.log(`Acesso pela rede: ${publicBaseUrl}`);
  console.log(`Pareamento pelo celular: ${pairingUrl()}`);
  setInterval(heartbeat, configuration.heartbeatIntervalMs);
  setInterval(pollDeliveries, configuration.pollIntervalMs);
});
