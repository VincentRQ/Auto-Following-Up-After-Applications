#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageInfo = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = packageInfo.version;
const releaseRoot = join(root, "release");
const stageName = `outreach-console-lite-${version}`;
const stageRoot = join(releaseRoot, stageName);
const archiveName = `${stageName}.tgz`;
const archivePath = join(releaseRoot, archiveName);
const sizeLimit = 50 * 1024 * 1024;

assertInside(releaseRoot, stageRoot);
assertInside(releaseRoot, archivePath);

requireFile(join(root, "dist", "index.html"), "Run npm run build first.");
requireFile(join(root, "dist", "outreach-mcp.js"), "Run npm run build:mcp first.");

mkdirSync(releaseRoot, { recursive: true });
rmSync(stageRoot, { recursive: true, force: true });
rmSync(archivePath, { force: true });
mkdirSync(stageRoot, { recursive: true });

const webRoot = join(stageRoot, "web");
cpSync(join(root, "dist"), webRoot, {
  recursive: true,
  filter: (source) => resolve(source) !== resolve(root, "dist", "outreach-mcp.js"),
});

const backendRoot = join(stageRoot, "backend");
mkdirSync(backendRoot, { recursive: true });
for (const name of ["ai-cli.js", "config.js", "database.js", "openai-compatible.js", "providers.js", "server.js", "service.js"]) {
  cpSync(join(root, "backend", name), join(backendRoot, name));
}

mkdirSync(join(stageRoot, "mcp"), { recursive: true });
cpSync(join(root, "dist", "outreach-mcp.js"), join(stageRoot, "mcp", "outreach-mcp.js"));
cpSync(join(root, "docs", "LITE_DISTRIBUTION.md"), join(stageRoot, "README.md"));
cpSync(join(root, "docs"), join(stageRoot, "docs"), { recursive: true });
cpSync(join(root, "schemas"), join(stageRoot, "schemas"), { recursive: true });
cpSync(join(root, "skills"), join(stageRoot, "skills"), { recursive: true });

for (const name of [".env.example", "outreach.config.example.json", "LICENSE", "NOTICE", "PRIVACY.md", "SECURITY.md"]) {
  cpSync(join(root, name), join(stageRoot, name));
}

mkdirSync(join(stageRoot, "data"), { recursive: true });
for (const name of ["sample-applications.csv", "sample-recruiter-contacts.csv"]) {
  const source = join(root, "data", name);
  if (existsSync(source)) cpSync(source, join(stageRoot, "data", name));
}
writeFileSync(join(stageRoot, "data", "README.txt"), "Outreach Console creates its optional local SQLite database in this folder.\n", "utf8");

writeFileSync(join(stageRoot, "package.json"), `${JSON.stringify({
  name: "outreach-console-lite",
  version,
  private: true,
  type: "module",
  engines: { node: ">=24" },
  scripts: {
    start: "node start.mjs",
    mcp: "node mcp/outreach-mcp.js",
  },
}, null, 2)}\n`, "utf8");

writeFileSync(join(stageRoot, "start.mjs"), `import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createOutreachServer } from "./backend/server.js";

const root = dirname(fileURLToPath(import.meta.url));
process.chdir(root);
const port = Number(process.env.OUTREACH_PORT ?? 43127);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("OUTREACH_PORT must be an integer from 1024 through 65535.");
const host = "127.0.0.1";
const origin = \`http://\${host}:\${port}\`;
const server = createOutreachServer({
  databasePath: process.env.OUTREACH_DATABASE ?? join(root, "data", "outreach.sqlite"),
  staticRoot: join(root, "web"),
  allowedOrigins: new Set([origin, \`http://localhost:\${port}\`]),
});

server.listen(port, host, () => {
  console.log(\`Outreach Console: \${origin}\`);
  console.log("No npm install is required. Press Ctrl+C to stop.");
  if (process.env.OUTREACH_NO_OPEN !== "1") openBrowser(origin);
});

function openBrowser(url) {
  const target = process.platform === "win32"
    ? { command: "rundll32.exe", args: ["url.dll,FileProtocolHandler", url] }
    : process.platform === "darwin" ? { command: "open", args: [url] } : { command: "xdg-open", args: [url] };
  const child = spawn(target.command, target.args, { stdio: "ignore", windowsHide: true, detached: true });
  child.on("error", () => console.log(\`Open \${url} in a browser.\`));
  child.unref();
}
`, "utf8");

writeFileSync(join(stageRoot, "Start Outreach Console.cmd"), `@echo off\r
cd /d "%~dp0"\r
where node >nul 2>nul\r
if errorlevel 1 (\r
  echo Node.js 24 or newer is required.\r
  echo Download it from https://nodejs.org/en/download\r
  pause\r
  exit /b 1\r
)\r
node start.mjs\r
if errorlevel 1 pause\r
`, "utf8");

writeFileSync(join(stageRoot, "Start Outreach Console - Sample Mode.cmd"), `@echo off\r
cd /d "%~dp0"\r
where node >nul 2>nul\r
if errorlevel 1 (\r
  echo Node.js 24 or newer is required.\r
  echo Download it from https://nodejs.org/en/download\r
  pause\r
  exit /b 1\r
)\r
set "OUTREACH_PUBLIC_SAMPLE_MODE=1"\r
node start.mjs\r
if errorlevel 1 pause\r
`, "utf8");

const shellLauncher = join(stageRoot, "start-outreach-console.sh");
writeFileSync(shellLauncher, `#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 or newer is required: https://nodejs.org/en/download" >&2
  exit 1
fi
exec node start.mjs
`, "utf8");
chmodSync(shellLauncher, 0o755);

const sampleShellLauncher = join(stageRoot, "start-outreach-console-sample.sh");
writeFileSync(sampleShellLauncher, `#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 or newer is required: https://nodejs.org/en/download" >&2
  exit 1
fi
export OUTREACH_PUBLIC_SAMPLE_MODE=1
exec node start.mjs
`, "utf8");
chmodSync(sampleShellLauncher, 0o755);

const contentFiles = listFiles(stageRoot);
const forbiddenFiles = contentFiles.filter((path) => {
  const name = relative(stageRoot, path).replaceAll("\\", "/");
  return /(^|\/)(node_modules|\.git)(\/|$)/.test(name)
    || /(^|\/)\.env$/i.test(name)
    || /\.(sqlite(?:-shm|-wal)?|xlsx?|xlsm|xlsb|log|map)$/i.test(name);
});
if (forbiddenFiles.length) {
  throw new Error(`Lite release contains forbidden files: ${forbiddenFiles.map((path) => relative(stageRoot, path)).join(", ")}`);
}
const manifestFiles = contentFiles.map((path) => {
  const content = readFileSync(path);
  return {
    path: relative(stageRoot, path).replaceAll("\\", "/"),
    bytes: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
});
const contentBytes = manifestFiles.reduce((total, file) => total + file.bytes, 0);
const manifest = {
  name: "Outreach Console Lite",
  version,
  createdAt: new Date().toISOString(),
  maximumArchiveBytes: sizeLimit,
  dependencyInstallRequired: false,
  nodeVersion: ">=24",
  contentBytes,
  files: manifestFiles,
};
writeFileSync(join(stageRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const stagedBytes = directorySize(stageRoot);
if (stagedBytes > sizeLimit) throw new Error(`Lite release folder is ${formatMb(stagedBytes)}, above the 50 MB limit.`);

const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli)) throw new Error("Run this packager through npm run stage:lite or npm run pack:lite.");
const packed = JSON.parse(execFileSync(process.execPath, [npmCli, "pack", stageRoot, "--pack-destination", releaseRoot, "--ignore-scripts", "--json"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
}));
const generatedName = packed[0]?.filename;
if (!generatedName) throw new Error("npm pack did not return an archive name.");
const generatedPath = join(releaseRoot, generatedName);
assertInside(releaseRoot, generatedPath);
if (generatedPath !== archivePath) {
  rmSync(archivePath, { force: true });
  cpSync(generatedPath, archivePath);
  rmSync(generatedPath, { force: true });
}

const archiveBytes = statSync(archivePath).size;
if (archiveBytes > sizeLimit) throw new Error(`Lite release archive is ${formatMb(archiveBytes)}, above the 50 MB limit.`);

console.log(`Lite folder: ${relative(root, stageRoot)} (${formatMb(stagedBytes)})`);
console.log(`Lite archive: ${relative(root, archivePath)} (${formatMb(archiveBytes)})`);
console.log("Runtime npm dependencies: 0");

function requireFile(path, message) {
  if (!existsSync(path)) throw new Error(`${message} Missing: ${path}`);
}

function assertInside(parent, candidate) {
  const pathFromParent = relative(resolve(parent), resolve(candidate));
  if (!pathFromParent || pathFromParent.startsWith("..") || isAbsolute(pathFromParent)) {
    throw new Error(`Release path must stay inside ${parent}: ${candidate}`);
  }
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    })
    .sort((left, right) => left.localeCompare(right));
}

function directorySize(directory) {
  return listFiles(directory).reduce((total, path) => total + statSync(path).size, 0);
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
