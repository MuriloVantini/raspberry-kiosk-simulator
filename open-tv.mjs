import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const kioskProfile = join(tmpdir(), "mobile2screen-edge-kiosk");
const browser = spawn(edgePath, [
  "--kiosk",
  "--edge-kiosk-type=fullscreen",
  "--no-first-run",
  `--user-data-dir=${kioskProfile}`,
  "http://localhost:3333",
], {
  detached: true,
  stdio: "ignore",
});

browser.unref();
console.log("TV aberta no Microsoft Edge em modo kiosk.");
