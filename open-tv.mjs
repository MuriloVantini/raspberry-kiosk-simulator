import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConfiguration, projectDirectory } from "./server/config.mjs";

const configuration = createConfiguration({ KIOSK_PUBLIC_HOST: process.env.KIOSK_PUBLIC_HOST });

async function serverIsReady() {
  try { return (await fetch(`http://127.0.0.1:${configuration.port}/health`)).ok; }
  catch { return false; }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await serverIsReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("O servidor do kiosk não iniciou a tempo.");
}

function findEdge() {
  const candidates = [
    process.env["ProgramFiles(x86)"] && join(process.env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

const edgePath = findEdge();
if (!edgePath) throw new Error("Microsoft Edge não foi encontrado neste computador.");

let serverProcess = null;
if (!(await serverIsReady())) {
  serverProcess = spawn(process.execPath, [join(projectDirectory, "server.mjs")], { cwd: projectDirectory, stdio: "inherit", env: process.env });
  await waitForServer();
}

const browser = spawn(edgePath, ["--kiosk", "--edge-kiosk-type=fullscreen", "--autoplay-policy=no-user-gesture-required", "--no-first-run", `--user-data-dir=${join(tmpdir(), "mobile2screen-edge-kiosk")}`, configuration.publicBaseUrl], { detached: true, stdio: "ignore" });
browser.unref();
console.log(`TV aberta no Microsoft Edge: ${configuration.publicBaseUrl}`);

if (serverProcess) {
  const stopServer = () => serverProcess?.kill();
  process.on("SIGINT", stopServer);
  process.on("SIGTERM", stopServer);
  await new Promise((resolve) => serverProcess.once("exit", resolve));
}
