#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageInfo = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const archivePath = join(root, "release", `outreach-console-lite-${packageInfo.version}.tgz`);
if (!existsSync(archivePath)) throw new Error("Build the Lite release before running its smoke test.");
const extractRoot = mkdtempSync(join(tmpdir(), "outreach-lite-smoke-"));
const cleanup = () => rmSync(extractRoot, { recursive: true, force: true });
process.once("exit", cleanup);
execFileSync("tar", ["-xzf", archivePath, "-C", extractRoot], { windowsHide: true });
const stageRoot = join(extractRoot, "package");
if (!existsSync(join(stageRoot, "start.mjs"))) throw new Error("Build the Lite release before running its smoke test.");
if (!existsSync(join(stageRoot, "Start Outreach Console.cmd"))
  || !existsSync(join(stageRoot, "Start Outreach Console - Sample Mode.cmd"))
  || !existsSync(join(stageRoot, "start-outreach-console.sh"))
  || !existsSync(join(stageRoot, "start-outreach-console-sample.sh"))) throw new Error("Lite release launchers are missing.");
if (!existsSync(join(stageRoot, "skills", "outreach-console-operator", "SKILL.md"))) throw new Error("Lite release operator skill is missing.");
if (existsSync(join(stageRoot, "node_modules"))) throw new Error("Lite release must not contain node_modules.");
const stagedPackage = JSON.parse(readFileSync(join(stageRoot, "package.json"), "utf8"));
if (Object.keys(stagedPackage.dependencies ?? {}).length) throw new Error("Lite release must not declare runtime npm dependencies.");

const port = await availablePort();
let output = "";
const child = spawn(process.execPath, ["start.mjs"], {
  cwd: stageRoot,
  env: {
    ...process.env,
    OUTREACH_PORT: String(port),
    OUTREACH_PUBLIC_SAMPLE_MODE: "1",
    OUTREACH_NO_OPEN: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });

try {
  const base = `http://127.0.0.1:${port}`;
  await waitUntilReady(`${base}/api/health`, child);
  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  if (health.status !== "ok") throw new Error(`Unexpected Lite health response: ${JSON.stringify(health)}`);
  if (health.providers?.enrichment !== "disabled" || health.providers?.mailbox !== "disabled") {
    throw new Error(`Sample Mode exposed private provider configuration: ${JSON.stringify(health.providers)}`);
  }
  const setup = await fetch(`${base}/api/setup/status`).then((response) => response.json());
  if (setup.publicSampleMode !== true || setup.liveSendEnabled !== false || setup.profiles?.length !== 0) {
    throw new Error(`Sample Mode setup isolation failed: ${JSON.stringify(setup)}`);
  }
  const page = await fetch(`${base}/`);
  const html = await page.text();
  if (!page.ok || !/^text\/html/.test(page.headers.get("content-type") ?? "") || !html.includes("id=\"root\"")) {
    throw new Error("Lite release did not serve the built GUI.");
  }
  const missing = await fetch(`${base}/not-a-real-file.txt`);
  if (missing.status !== 404) throw new Error(`Unexpected missing-file response: ${missing.status}`);
  console.log(`Lite smoke test passed on ${base}.`);
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2000)),
  ]);
  cleanup();
  process.removeListener("exit", cleanup);
}

async function availablePort() {
  const probe = createServer();
  await new Promise((resolveListen, reject) => probe.once("error", reject).listen(0, "127.0.0.1", resolveListen));
  const port = probe.address().port;
  await new Promise((resolveClose) => probe.close(resolveClose));
  return port;
}

async function waitUntilReady(url, processHandle) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Lite process exited early.\n${output}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The child process may still be binding its loopback port.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Lite release did not become ready.\n${output}`);
}
