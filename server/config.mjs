import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectDirectory = dirname(fileURLToPath(new URL("../server.mjs", import.meta.url)));

function loadEnvironment(filePath) {
  if (!existsSync(filePath)) return {};
  return readFileSync(filePath, "utf8").split(/\r?\n/).reduce((values, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return values;
    const separator = trimmed.indexOf("=");
    if (separator < 1) return values;
    const key = trimmed.slice(0, separator).trim();
    values[key] = trimmed.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    return values;
  }, {});
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function findLanAddress() {
  const addresses = Object.values(networkInterfaces()).flatMap((items) => items ?? []).filter((item) => item.family === "IPv4" && !item.internal).map((item) => item.address);
  return addresses.find((address) => address.startsWith("192.168."))
    ?? addresses.find((address) => address.startsWith("10."))
    ?? addresses.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address))
    ?? addresses[0]
    ?? "localhost";
}

export function createConfiguration(overrides = {}) {
  const env = { ...loadEnvironment(join(projectDirectory, ".env")), ...process.env, ...overrides };
  const port = positiveNumber(env.KIOSK_PORT, 3333);
  const publicHost = env.KIOSK_PUBLIC_HOST || findLanAddress();
  return {
    apiBaseUrl: String(env.M2S_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, ""),
    assetDirectory: join(projectDirectory, "dist"),
    port,
    publicBaseUrl: String(env.KIOSK_PUBLIC_URL || `http://${publicHost}:${port}`).replace(/\/$/, ""),
    pollIntervalMs: positiveNumber(env.POLL_INTERVAL_MS, 3000),
    heartbeatIntervalMs: positiveNumber(env.HEARTBEAT_INTERVAL_MS, 15000),
  };
}
