#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAndValidateBundle } from "../backend/updater.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageInfo = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const archivePath = join(root, "release", `outreach-console-lite-${packageInfo.version}.tgz`);
const zipPath = join(root, "release", `outreach-console-lite-${packageInfo.version}.zip`);
const updateBundlePath = join(root, "release", `outreach-console-update-${packageInfo.version}.json`);
if (!existsSync(archivePath)) throw new Error("Build the Lite release before running its smoke test.");
if (!existsSync(zipPath) || !existsSync(updateBundlePath)) throw new Error("Lite ZIP or update bundle is missing.");
const extractRoot = mkdtempSync(join(tmpdir(), "outreach-lite-smoke-"));
const zipExtractRoot = mkdtempSync(join(tmpdir(), "outreach-lite-zip-smoke-"));
const cleanup = () => {
  rmSync(extractRoot, { recursive: true, force: true });
  rmSync(zipExtractRoot, { recursive: true, force: true });
};
process.once("exit", cleanup);
execFileSync("tar", ["-xzf", archivePath, "-C", extractRoot], { windowsHide: true });
if (process.platform === "win32") {
  const archive = zipPath.replaceAll("'", "''");
  const destination = zipExtractRoot.replaceAll("'", "''");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${destination}' -Force`], { windowsHide: true });
} else {
  execFileSync("unzip", ["-q", zipPath, "-d", zipExtractRoot], { windowsHide: true });
}
const stageRoot = join(extractRoot, "package");
const zipStageRoot = join(zipExtractRoot, `outreach-console-lite-${packageInfo.version}`);
if (!existsSync(join(stageRoot, "start.mjs"))) throw new Error("Build the Lite release before running its smoke test.");
if (!existsSync(join(zipStageRoot, "start.mjs"))) throw new Error("The Lite ZIP does not contain the expected top-level application folder.");
if (!existsSync(join(stageRoot, "Start Outreach Console.cmd"))
  || !existsSync(join(stageRoot, "Start Outreach Console - Sample Mode.cmd"))
  || !existsSync(join(stageRoot, "bootstrap-node.ps1"))
  || !existsSync(join(stageRoot, "bootstrap-node.sh"))
  || !existsSync(join(stageRoot, "Start Outreach Console.command"))
  || !existsSync(join(stageRoot, "Start Outreach Console - Sample Mode.command"))
  || !existsSync(join(stageRoot, "start-outreach-console.sh"))
  || !existsSync(join(stageRoot, "start-outreach-console-sample.sh"))) throw new Error("Lite release launchers are missing.");
if (!existsSync(join(stageRoot, "skills", "outreach-console-operator", "SKILL.md"))) throw new Error("Lite release operator skill is missing.");
if (existsSync(join(stageRoot, "node_modules"))) throw new Error("Lite release must not contain node_modules.");
const stagedPackage = JSON.parse(readFileSync(join(stageRoot, "package.json"), "utf8"));
if (Object.keys(stagedPackage.dependencies ?? {}).length) throw new Error("Lite release must not declare runtime npm dependencies.");
const updateBundle = parseAndValidateBundle(readFileSync(updateBundlePath), packageInfo.version);
if (!updateBundle.files.some((file) => file.path === "web/index.html") || updateBundle.files.some((file) => file.path.startsWith("data/"))) {
  throw new Error("The update bundle must include the GUI and exclude user data.");
}
const shell = process.platform === "win32" ? windowsGitShell() : "sh";
if (shell) {
  execFileSync(shell, ["-n", join(stageRoot, "bootstrap-node.sh")], { windowsHide: true });
  execFileSync(shell, ["-n", join(stageRoot, "start-outreach-console.sh")], { windowsHide: true });
  execFileSync(shell, ["-n", join(stageRoot, "start-outreach-console-sample.sh")], { windowsHide: true });
}
if (process.platform === "win32") {
  const bootstrapPath = join(stageRoot, "bootstrap-node.ps1").replaceAll("'", "''");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${bootstrapPath}', [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }`], { windowsHide: true });
}

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
  const updateStatus = await fetch(`${base}/api/updates/status`).then((response) => response.json());
  if (updateStatus.state !== "unsupported" || !/sample mode/i.test(updateStatus.detail)) throw new Error(`Sample Mode update lock failed: ${JSON.stringify(updateStatus)}`);
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

function windowsGitShell() {
  try {
    const git = execFileSync("where.exe", ["git"], { encoding: "utf8", windowsHide: true }).split(/\r?\n/).find(Boolean);
    const candidate = git ? join(dirname(dirname(git.trim())), "bin", "sh.exe") : "";
    return candidate && existsSync(candidate) ? candidate : "";
  } catch {
    return "";
  }
}
