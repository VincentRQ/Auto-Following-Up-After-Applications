#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageInfo = await import("../package.json", { with: { type: "json" } });
const version = packageInfo.default.version;
const limits = {
  publicSource: 5 * 1024 * 1024,
  builtGui: 5 * 1024 * 1024,
  bundledMcp: 5 * 1024 * 1024,
  liteArchive: 50 * 1024 * 1024,
  liteZip: 50 * 1024 * 1024,
  updateBundle: 50 * 1024 * 1024,
};

const candidateFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean).map((path) => join(root, path)).filter((path) => existsSync(path) && statSync(path).isFile());
const guiFiles = existsSync(join(root, "dist"))
  ? listFiles(join(root, "dist")).filter((path) => !path.endsWith("outreach-mcp.js"))
  : [];
const mcpPath = join(root, "dist", "outreach-mcp.js");
const archivePath = join(root, "release", `outreach-console-lite-${version}.tgz`);
const zipPath = join(root, "release", `outreach-console-lite-${version}.zip`);
const updateBundlePath = join(root, "release", `outreach-console-update-${version}.json`);

const measurements = [
  measure("Public source candidate", totalSize(candidateFiles), limits.publicSource, candidateFiles.length > 0),
  measure("Built GUI", totalSize(guiFiles), limits.builtGui, guiFiles.length > 0),
  measure("Standalone MCP", existsSync(mcpPath) ? statSync(mcpPath).size : 0, limits.bundledMcp, existsSync(mcpPath)),
  measure("Lite archive", existsSync(archivePath) ? statSync(archivePath).size : 0, limits.liteArchive, existsSync(archivePath)),
  measure("Lite ZIP", existsSync(zipPath) ? statSync(zipPath).size : 0, limits.liteZip, existsSync(zipPath)),
  measure("Update bundle", existsSync(updateBundlePath) ? statSync(updateBundlePath).size : 0, limits.updateBundle, existsSync(updateBundlePath)),
];

for (const item of measurements) {
  console.log(`${item.label}: ${formatMb(item.bytes)} / ${formatMb(item.limit)}`);
}
const missing = measurements.filter((item) => !item.present);
if (missing.length) throw new Error(`Missing size-audit inputs: ${missing.map((item) => item.label).join(", ")}`);
const failures = measurements.filter((item) => item.bytes > item.limit);
if (failures.length) throw new Error(`Size budget exceeded: ${failures.map((item) => item.label).join(", ")}`);
console.log("Size audit passed.");

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function totalSize(paths) {
  return paths.reduce((total, path) => total + statSync(path).size, 0);
}

function measure(label, bytes, limit, present) {
  return { label, bytes, limit, present };
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
