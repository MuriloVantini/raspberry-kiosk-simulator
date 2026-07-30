import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = join(rootDirectory, "public");
const env = loadEnvironment(join(rootDirectory, ".env"));

const configuration = {
  apiBaseUrl: withoutTrailingSlash(env.M2S_API_BASE_URL ?? "http://localhost:8000"),
  deviceId: env.M2S_DEVICE_ID ?? "",
  deviceToken: env.M2S_DEVICE_TOKEN ?? "",
  port: asPositiveNumber(env.KIOSK_PORT, 3333),
  pollIntervalMs: asPositiveNumber(env.POLL_INTERVAL_MS, 3000),
  heartbeatIntervalMs: asPositiveNumber(env.HEARTBEAT_INTERVAL_MS, 15000),
};

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

function isConfigured() {
  return Boolean(configuration.deviceId && configuration.deviceToken && configuration.deviceToken !== "cole_o_connection_token_aqui");
}

function apiUrl(path) {
  return `${configuration.apiBaseUrl}${path}`;
}

async function callDeviceApi(path, options = {}) {
  if (!isConfigured()) {
    throw new Error("Configure M2S_DEVICE_ID e M2S_DEVICE_TOKEN no arquivo .env.");
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
    sendJson(response, 200, { status: "ok", configured: isConfigured(), ...connection });
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

server.listen(configuration.port, () => {
  console.log(`Simulador Raspberry/TV disponível em http://localhost:${configuration.port}`);

  if (!isConfigured()) {
    console.log("Configure o arquivo .env antes de conectar o dispositivo.");
    return;
  }

  connectDevice().catch((error) => {
    connection = { ...connection, lastError: error.message };
    console.error(`Não foi possível conectar à API: ${error.message}`);
  });

  setInterval(heartbeat, configuration.heartbeatIntervalMs);
  setInterval(pollDeliveries, configuration.pollIntervalMs);
});
