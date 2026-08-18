import { createServer } from "node:http";
import QRCode from "qrcode";
import { readJson, sendJson, serveReactApp } from "./http.mjs";

export function createKioskServer(configuration, kiosk) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname === "/health") return sendJson(response, 200, { status: "ok", ...kiosk.snapshot() });
    if (url.pathname === "/events") return kiosk.subscribe(request, response);

    if (url.pathname === "/api/pairing" && request.method === "GET") {
      const session = url.searchParams.get("session");
      if (session && session !== kiosk.pairing.token) return sendJson(response, 410, { message: "Sessão de pareamento expirada." });
      return sendJson(response, 200, { session: kiosk.pairing.token, url: kiosk.pairingUrl(), configured: kiosk.isConfigured() });
    }

    if (url.pathname === "/pairing-qr.svg" && request.method === "GET") {
      try {
        const svg = await QRCode.toString(kiosk.pairingUrl(), { type: "svg", margin: 2, width: 420, errorCorrectionLevel: "M" });
        response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" });
        return response.end(svg);
      } catch (error) { return sendJson(response, 500, { message: error.message }); }
    }

    if (url.pathname === "/profile-image" && request.method === "GET") {
      try {
        const image = await kiosk.fetchProfileImage();
        response.writeHead(200, { "Content-Type": image.contentType, "Cache-Control": "no-store" });
        return response.end(image.body);
      } catch (error) { return sendJson(response, 404, { message: error.message }); }
    }

    if (url.pathname === "/api/pair/login" && request.method === "POST") {
      try { const body = await readJson(request); return sendJson(response, 200, await kiosk.login(body.session, body.email, body.password)); }
      catch (error) { return sendJson(response, 401, { message: error.message }); }
    }

    if (url.pathname === "/api/pair/devices" && request.method === "POST") {
      try { const body = await readJson(request); return sendJson(response, 200, { data: await kiosk.listDevices(body.session) }); }
      catch (error) { return sendJson(response, 401, { message: error.message }); }
    }

    if (url.pathname === "/api/pair/select" && request.method === "POST") {
      try { const body = await readJson(request); return sendJson(response, 200, { data: await kiosk.selectDevice(body.session, body.device_id) }); }
      catch (error) { return sendJson(response, 400, { message: error.message }); }
    }

    if (url.pathname === "/api/connect" && request.method === "POST") {
      try { return sendJson(response, 200, { data: await kiosk.connectDevice() }); }
      catch (error) { return sendJson(response, 502, { message: error.message }); }
    }

    if (url.pathname === "/api/current-alert" && request.method === "GET") return sendJson(response, 200, { delivery_id: kiosk.currentDeliveryId });
    if (url.pathname === "/api/complete-alert" && request.method === "POST") {
      try { await kiosk.completeAlert(); return sendJson(response, 200, { message: "Alerta concluído" }); }
      catch (error) { return sendJson(response, error.message.startsWith("Nenhum") ? 409 : 502, { message: error.message }); }
    }

    return serveReactApp(url.pathname, configuration.assetDirectory, response);
  });
}
