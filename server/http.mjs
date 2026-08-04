import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

export function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

export async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new Error("Requisição muito grande.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function serveReactApp(requestPath, assetDirectory, response) {
  const safePath = normalize(requestPath).replace(/^(\.\.(\\|\/|$))+/, "");
  let filePath = join(assetDirectory, safePath === "/" || safePath === "\\" ? "index.html" : safePath);
  if (!filePath.startsWith(assetDirectory) || !existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(assetDirectory, "index.html");
  if (!existsSync(filePath)) {
    sendJson(response, 503, { message: "Build React ausente. Execute npm run build." });
    return;
  }
  const mimeTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}
