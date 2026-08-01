#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createUpdateBundle } from "../backend/updater.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageInfo = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = packageInfo.version;
const releaseRoot = join(root, "release");
const stageName = `outreach-console-lite-${version}`;
const stageRoot = join(releaseRoot, stageName);
const archiveName = `${stageName}.tgz`;
const archivePath = join(releaseRoot, archiveName);
const zipPath = join(releaseRoot, `${stageName}.zip`);
const updateBundlePath = join(releaseRoot, `outreach-console-update-${version}.json`);
const sizeLimit = 50 * 1024 * 1024;

assertInside(releaseRoot, stageRoot);
assertInside(releaseRoot, archivePath);
assertInside(releaseRoot, zipPath);
assertInside(releaseRoot, updateBundlePath);

requireFile(join(root, "dist", "index.html"), "Run npm run build first.");
requireFile(join(root, "dist", "outreach-mcp.js"), "Run npm run build:mcp first.");

mkdirSync(releaseRoot, { recursive: true });
rmSync(stageRoot, { recursive: true, force: true });
rmSync(archivePath, { force: true });
rmSync(zipPath, { force: true });
rmSync(updateBundlePath, { force: true });
mkdirSync(stageRoot, { recursive: true });

const webRoot = join(stageRoot, "web");
cpSync(join(root, "dist"), webRoot, {
  recursive: true,
  filter: (source) => resolve(source) !== resolve(root, "dist", "outreach-mcp.js"),
});

const backendRoot = join(stageRoot, "backend");
mkdirSync(backendRoot, { recursive: true });
for (const name of ["ai-cli.js", "config.js", "database.js", "openai-compatible.js", "providers.js", "server.js", "service.js", "updater.js"]) {
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
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyPendingUpdate, createUpdateManager } from "./backend/updater.js";

const root = dirname(fileURLToPath(import.meta.url));
process.chdir(root);
const applied = await applyPendingUpdate(root);
if (applied.applied) console.log(\`Installed Outreach Console \${applied.version} from the verified update bundle.\`);
const packageInfo = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const updateManager = createUpdateManager({ root, currentVersion: packageInfo.version });
const { createOutreachServer } = await import(\`./backend/server.js?loaded=\${Date.now()}\`);
const port = Number(process.env.OUTREACH_PORT ?? 43127);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("OUTREACH_PORT must be an integer from 1024 through 65535.");
const host = "127.0.0.1";
const origin = \`http://\${host}:\${port}\`;
let server;
server = createOutreachServer({
  databasePath: process.env.OUTREACH_DATABASE ?? join(root, "data", "outreach.sqlite"),
  staticRoot: join(root, "web"),
  allowedOrigins: new Set([origin, \`http://localhost:\${port}\`]),
  updateManager,
  onRestartRequested: () => {
    console.log("Verified update staged. Restarting Outreach Console...");
    server.close(() => {
      const child = spawn(process.execPath, ["start.mjs"], { cwd: root, env: process.env, stdio: "ignore", windowsHide: true, detached: true });
      child.unref();
      process.exit(0);
    });
  },
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

writeFileSync(join(stageRoot, "bootstrap-node.ps1"), `$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = Join-Path $root ".runtime"
$nodeRoot = Join-Path $runtimeRoot "node"
$nodeExe = Join-Path $nodeRoot "node.exe"
if (Test-Path $nodeExe) {
  $major = & $nodeExe -p "Number(process.versions.node.split('.')[0])" 2>$null
  if ($LASTEXITCODE -eq 0 -and [int]$major -ge 24) { exit 0 }
}
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq "Arm64") { "arm64" } else { "x64" }
$base = "https://nodejs.org/dist/latest-v24.x"
$checksums = (Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt").Content
$line = ($checksums -split "\`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^[a-fA-F0-9]{64}\\s+node-v24\\.[0-9.]+-win-$arch\\.zip$" } | Select-Object -First 1)
if (-not $line) { throw "Could not locate the official Node 24 Windows archive." }
$parts = $line -split "\\s+"
$expected = $parts[0].ToLowerInvariant()
$archive = $parts[-1]
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("outreach-node-" + [Guid]::NewGuid().ToString("N") + ".zip")
$extract = Join-Path ([System.IO.Path]::GetTempPath()) ("outreach-node-" + [Guid]::NewGuid().ToString("N"))
try {
  Invoke-WebRequest -UseBasicParsing "$base/$archive" -OutFile $temp
  $actual = (Get-FileHash -Algorithm SHA256 $temp).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "The portable Node archive checksum did not match nodejs.org." }
  Expand-Archive -LiteralPath $temp -DestinationPath $extract -Force
  $folder = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
  if (-not $folder -or -not (Test-Path (Join-Path $folder.FullName "node.exe"))) { throw "The portable Node archive did not contain node.exe." }
  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
  if (Test-Path -LiteralPath $nodeRoot) { Remove-Item -LiteralPath $nodeRoot -Recurse -Force }
  Move-Item -LiteralPath $folder.FullName -Destination $nodeRoot
} finally {
  Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $extract -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "Portable Node 24 is ready in .runtime\\node."
`, "utf8");

const shellBootstrap = join(stageRoot, "bootstrap-node.sh");
writeFileSync(shellBootstrap, `#!/usr/bin/env sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node_root="$root/.runtime/node"
node_exe="$node_root/bin/node"
if [ -x "$node_exe" ] && [ "$("$node_exe" -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf 0)" -ge 24 ]; then
  exit 0
fi
case "$(uname -s)" in
  Darwin) platform="darwin" ;;
  Linux) platform="linux" ;;
  *) echo "Automatic portable Node setup supports macOS and Linux only." >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64) arch="x64" ;;
  *) echo "This processor architecture is not supported by the portable launcher." >&2; exit 1 ;;
esac
base="https://nodejs.org/dist/latest-v24.x"
tmp=$(mktemp -d "\${TMPDIR:-/tmp}/outreach-node.XXXXXX")
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
checksums=$(curl --fail --silent --show-error --location "$base/SHASUMS256.txt")
archive=$(printf '%s\n' "$checksums" | awk -v suffix="-$platform-$arch.tar" '$2 ~ suffix "\\.(gz|xz)$" { print $2; exit }')
[ -n "$archive" ] || { echo "Could not locate the official Node 24 archive." >&2; exit 1; }
expected=$(printf '%s\n' "$checksums" | awk -v name="$archive" '$2 == name { print $1; exit }')
curl --fail --silent --show-error --location "$base/$archive" --output "$tmp/$archive"
if command -v shasum >/dev/null 2>&1; then actual=$(shasum -a 256 "$tmp/$archive" | awk '{print $1}');
elif command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$tmp/$archive" | awk '{print $1}');
else echo "A SHA-256 checksum tool is required." >&2; exit 1; fi
[ "$actual" = "$expected" ] || { echo "The portable Node archive checksum did not match nodejs.org." >&2; exit 1; }
mkdir -p "$tmp/extract" "$root/.runtime"
tar -xf "$tmp/$archive" -C "$tmp/extract"
folder=$(find "$tmp/extract" -mindepth 1 -maxdepth 1 -type d | head -n 1)
[ -n "$folder" ] && [ -x "$folder/bin/node" ] || { echo "The portable Node archive did not contain Node." >&2; exit 1; }
rm -rf "$node_root"
mv "$folder" "$node_root"
printf '%s\n' "Portable Node 24 is ready in .runtime/node."
`, "utf8");
chmodSync(shellBootstrap, 0o755);

writeFileSync(join(stageRoot, "Start Outreach Console.cmd"), `@echo off\r
cd /d "%~dp0"\r
set "NODE_EXE=node"\r
where node >nul 2>nul || set "NODE_EXE=%~dp0.runtime\\node\\node.exe"\r
"%NODE_EXE%" -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)" >nul 2>nul\r
if errorlevel 1 (\r
  choice /M "Download a verified portable Node 24 runtime from nodejs.org"\r
  if errorlevel 2 exit /b 1\r
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap-node.ps1"\r
  if errorlevel 1 (pause & exit /b 1)\r
  set "NODE_EXE=%~dp0.runtime\\node\\node.exe"\r
)\r
"%NODE_EXE%" start.mjs\r
if errorlevel 1 pause\r
`, "utf8");

writeFileSync(join(stageRoot, "Start Outreach Console - Sample Mode.cmd"), `@echo off\r
cd /d "%~dp0"\r
set "NODE_EXE=node"\r
where node >nul 2>nul || set "NODE_EXE=%~dp0.runtime\\node\\node.exe"\r
"%NODE_EXE%" -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)" >nul 2>nul\r
if errorlevel 1 (\r
  choice /M "Download a verified portable Node 24 runtime from nodejs.org"\r
  if errorlevel 2 exit /b 1\r
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap-node.ps1"\r
  if errorlevel 1 (pause & exit /b 1)\r
  set "NODE_EXE=%~dp0.runtime\\node\\node.exe"\r
)\r
set "OUTREACH_PUBLIC_SAMPLE_MODE=1"\r
"%NODE_EXE%" start.mjs\r
if errorlevel 1 pause\r
`, "utf8");

const shellLauncher = join(stageRoot, "start-outreach-console.sh");
writeFileSync(shellLauncher, `#!/usr/bin/env sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$root"
node_exe=$(command -v node 2>/dev/null || true)
if [ -z "$node_exe" ] || [ "$("$node_exe" -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf 0)" -lt 24 ]; then
  printf 'Download a verified portable Node 24 runtime from nodejs.org? [y/N] '
  read answer
  case "$answer" in y|Y|yes|YES) ;; *) exit 1 ;; esac
  "$root/bootstrap-node.sh"
  node_exe="$root/.runtime/node/bin/node"
fi
exec "$node_exe" start.mjs
`, "utf8");
chmodSync(shellLauncher, 0o755);

const sampleShellLauncher = join(stageRoot, "start-outreach-console-sample.sh");
writeFileSync(sampleShellLauncher, `#!/usr/bin/env sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$root"
node_exe=$(command -v node 2>/dev/null || true)
if [ -z "$node_exe" ] || [ "$("$node_exe" -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf 0)" -lt 24 ]; then
  printf 'Download a verified portable Node 24 runtime from nodejs.org? [y/N] '
  read answer
  case "$answer" in y|Y|yes|YES) ;; *) exit 1 ;; esac
  "$root/bootstrap-node.sh"
  node_exe="$root/.runtime/node/bin/node"
fi
export OUTREACH_PUBLIC_SAMPLE_MODE=1
exec "$node_exe" start.mjs
`, "utf8");
chmodSync(sampleShellLauncher, 0o755);

for (const [name, script] of [["Start Outreach Console.command", "start-outreach-console.sh"], ["Start Outreach Console - Sample Mode.command", "start-outreach-console-sample.sh"]]) {
  const commandPath = join(stageRoot, name);
  writeFileSync(commandPath, `#!/usr/bin/env sh\nexec "$(dirname "$0")/${script}"\n`, "utf8");
  chmodSync(commandPath, 0o755);
}

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

const updateFiles = listFiles(stageRoot)
  .map((path) => relative(stageRoot, path).replaceAll("\\", "/"))
  .filter((path) => !path.startsWith("data/"));
const updateBundle = createUpdateBundle(stageRoot, version, updateFiles);
writeFileSync(updateBundlePath, `${JSON.stringify(updateBundle)}\n`, "utf8");

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

if (process.platform === "win32") {
  execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -LiteralPath '${stageRoot.replaceAll("'", "''")}' -DestinationPath '${zipPath.replaceAll("'", "''")}' -CompressionLevel Optimal -Force`], { windowsHide: true });
} else {
  execFileSync("zip", ["-qr", zipPath, stageName], { cwd: releaseRoot, windowsHide: true });
}
const zipBytes = statSync(zipPath).size;
if (zipBytes > sizeLimit) throw new Error(`Lite release ZIP is ${formatMb(zipBytes)}, above the 50 MB limit.`);
if (statSync(updateBundlePath).size > sizeLimit) throw new Error("Update bundle is above the 50 MB limit.");

console.log(`Lite folder: ${relative(root, stageRoot)} (${formatMb(stagedBytes)})`);
console.log(`Lite archive: ${relative(root, archivePath)} (${formatMb(archiveBytes)})`);
console.log(`Lite ZIP: ${relative(root, zipPath)} (${formatMb(zipBytes)})`);
console.log(`Update bundle: ${relative(root, updateBundlePath)} (${formatMb(statSync(updateBundlePath).size)})`);
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
