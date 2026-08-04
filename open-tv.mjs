import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { networkInterfaces, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.KIOSK_PORT) || 3333;

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

async function isServerRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isServerRunning()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("O servidor do kiosk não iniciou a tempo.");
}

const edgeCandidates = [
  process.env["ProgramFiles(x86)"] && join(process.env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
  process.env.ProgramFiles && join(process.env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
].filter(Boolean);
const edgePath = edgeCandidates.find((candidate) => existsSync(candidate));

if (!edgePath) {
  console.error("Microsoft Edge não foi encontrado neste computador.");
  process.exit(1);
}

let serverProcess = null;
if (!(await isServerRunning())) {
  serverProcess = spawn(process.execPath, [join(projectDirectory, "server.mjs")], {
    cwd: projectDirectory,
    stdio: "inherit",
    env: { ...process.env, KIOSK_PUBLIC_HOST: findLanAddress() },
  });
  await waitForServer();
}

const networkUrl = `http://${findLanAddress()}:${port}`;
const kioskProfile = join(tmpdir(), "mobile2screen-edge-kiosk");
const browser = spawn(edgePath, [
  "--kiosk",
  "--edge-kiosk-type=fullscreen",
  "--no-first-run",
  `--user-data-dir=${kioskProfile}`,
  networkUrl,
], { detached: true, stdio: "ignore" });

browser.unref();
console.log(`TV aberta no Microsoft Edge. Acesso pela rede: ${networkUrl}`);

if (serverProcess) {
  const stopServer = () => serverProcess?.kill();
  process.on("SIGINT", stopServer);
  process.on("SIGTERM", stopServer);
  await new Promise((resolve) => serverProcess.once("exit", resolve));
}
