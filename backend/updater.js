import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { copyFile, lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const defaultRepository = "VincentRQ/Auto-Following-Up-After-Applications";
const maximumBundleBytes = 50 * 1024 * 1024;
const maximumReleaseMetadataBytes = 1024 * 1024;
const managedRoots = new Set(["backend", "docs", "mcp", "schemas", "skills", "web"]);
const managedFiles = new Set([".env.example", "LICENSE", "NOTICE", "PRIVACY.md", "README.md", "SECURITY.md", "Start Outreach Console.cmd", "Start Outreach Console - Sample Mode.cmd", "Start Outreach Console.command", "Start Outreach Console - Sample Mode.command", "bootstrap-node.ps1", "bootstrap-node.sh", "outreach.config.example.json", "package.json", "release-manifest.json", "start-outreach-console.sh", "start-outreach-console-sample.sh", "start.mjs"]);
const allowedDownloadHosts = new Set(["api.github.com", "github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"]);

export function createUpdateManager({ root, currentVersion, repository = process.env.OUTREACH_UPDATE_REPOSITORY ?? defaultRepository, fetchImpl = fetch } = {}) {
  const installRoot = root ? resolve(root) : "";
  const repo = normalizeRepository(repository);
  let latest = null;
  let state = baseStatus(installRoot ? "idle" : "unsupported", currentVersion, installRoot ? "Ready to check for updates." : "Automatic updates are available only in the downloaded Lite release.");

  return {
    status() { return state; },
    async check() {
      if (!installRoot) return state;
      state = { ...state, state: "checking", detail: "Checking the official GitHub release...", checkedAt: new Date().toISOString() };
      try {
        const response = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Outreach-Console-Updater" }, redirect: "error" });
        if (!response.ok) throw new Error(`GitHub release check returned ${response.status}.`);
        const release = JSON.parse((await readLimitedResponse(response, maximumReleaseMetadataBytes, "GitHub release metadata")).toString("utf8"));
        const latestVersion = cleanVersion(release.tag_name || release.name);
        if (!latestVersion) throw new Error("The latest release does not have a valid semantic version.");
        const assetName = `outreach-console-update-${latestVersion}.json`;
        const asset = Array.isArray(release.assets) ? release.assets.find((item) => item?.name === assetName) : null;
        const available = compareVersions(latestVersion, currentVersion) > 0;
        latest = available && asset ? { version: latestVersion, asset, release } : null;
        state = {
          state: available ? asset ? "available" : "error" : "current",
          currentVersion,
          latestVersion,
          releaseName: String(release.name || release.tag_name || latestVersion).slice(0, 200),
          releaseUrl: safeReleaseUrl(release.html_url),
          publishedAt: String(release.published_at || ""),
          detail: available ? asset ? `Version ${latestVersion} is ready to install.` : `Version ${latestVersion} exists, but its verified update bundle is missing.` : `Version ${currentVersion} is current.`,
          canInstall: Boolean(available && asset),
          checkedAt: new Date().toISOString(),
        };
        return state;
      } catch (error) {
        latest = null;
        state = { ...state, state: "error", detail: safeError(error, "Update check failed."), canInstall: false, checkedAt: new Date().toISOString() };
        return state;
      }
    },
    async stage(confirmation) {
      if (!installRoot) throw updateError(409, "Automatic updates are unavailable in this build.");
      if (confirmation !== "INSTALL AND RESTART") throw updateError(400, "Update confirmation did not match.");
      if (!latest) await this.check();
      if (!latest || !state.canInstall) throw updateError(409, state.detail || "No verified update is available.");
      state = { ...state, state: "downloading", detail: `Downloading version ${latest.version}...`, canInstall: false };
      try {
        const downloadUrl = validateDownloadUrl(latest.asset.browser_download_url);
        const response = await fetchImpl(downloadUrl, { headers: { Accept: "application/octet-stream", "User-Agent": "Outreach-Console-Updater" }, redirect: "follow" });
        if (!response.ok) throw new Error(`Update download returned ${response.status}.`);
        validateDownloadUrl(response.url || downloadUrl);
        const bytes = await readLimitedResponse(response, maximumBundleBytes, "The update bundle");
        const expectedDigest = String(latest.asset.digest || "");
        if (expectedDigest.startsWith("sha256:") && sha256(bytes) !== expectedDigest.slice(7).toLowerCase()) throw new Error("The GitHub release digest did not match the downloaded update.");
        const bundle = parseAndValidateBundle(bytes, latest.version);
        const verifiedBytes = Buffer.from(`${JSON.stringify(bundle)}\n`, "utf8");
        const updatesRoot = resolve(installRoot, "data", "updates");
        ensureWithin(installRoot, updatesRoot);
        await assertNoLinks(installRoot, updatesRoot);
        await mkdir(updatesRoot, { recursive: true });
        await assertNoLinks(installRoot, updatesRoot);
        const bundlePath = resolve(updatesRoot, `outreach-console-update-${latest.version}.json`);
        ensureWithin(updatesRoot, bundlePath);
        // Intentional updater staging: the official-host response is size-capped, digest-checked when available,
        // reduced to the canonical schema, parsed through the managed-path allowlist, and verified per file.
        await writeFile(bundlePath, verifiedBytes, { flag: "w", mode: 0o600 });
        // Only normalized semantic-version metadata and the already bounded staging path are persisted here.
        await writeFile(resolve(updatesRoot, "pending-update.json"), `${JSON.stringify({ version: bundle.version, bundlePath, createdAt: new Date().toISOString() }, null, 2)}\n`, { flag: "w", mode: 0o600 });
        state = { ...state, state: "ready_to_restart", detail: `Version ${latest.version} is verified and will install during restart.`, canInstall: false };
        return state;
      } catch (error) {
        state = { ...state, state: "error", detail: safeError(error, "The update could not be staged."), canInstall: Boolean(latest), checkedAt: new Date().toISOString() };
        throw updateError(502, state.detail);
      }
    },
  };
}

export async function applyPendingUpdate(root) {
  const installRoot = resolve(root);
  const updatesRoot = resolve(installRoot, "data", "updates");
  const pendingPath = resolve(updatesRoot, "pending-update.json");
  await assertNoLinks(installRoot, pendingPath);
  if (!await exists(pendingPath)) return { applied: false, detail: "No pending update." };
  let pending;
  try { pending = JSON.parse(await readFile(pendingPath, "utf8")); }
  catch (error) { throw new Error(`Pending update metadata is unreadable: ${safeError(error, "invalid JSON")}`); }
  const bundlePath = resolve(String(pending.bundlePath || ""));
  ensureWithin(updatesRoot, bundlePath);
  await assertNoLinks(installRoot, bundlePath);
  const bytes = await readFile(bundlePath);
  const bundle = parseAndValidateBundle(bytes, String(pending.version || ""));
  const backupRoot = resolve(installRoot, "data", "update-backups", `${Date.now()}-${bundle.version}`);
  ensureWithin(installRoot, backupRoot);
  const applied = [];
  try {
    for (const file of bundle.files) {
      const target = managedTarget(installRoot, file.path);
      const backup = resolve(backupRoot, file.path);
      ensureWithin(backupRoot, backup);
      await assertNoLinks(installRoot, target);
      await assertNoLinks(installRoot, backup);
      const content = Buffer.from(file.base64, "base64");
      if (sha256(content) !== file.sha256 || content.byteLength !== file.bytes) throw new Error(`Update file verification failed: ${file.path}`);
      await mkdir(dirname(target), { recursive: true });
      const hadTarget = await exists(target);
      if (hadTarget) {
        await mkdir(dirname(backup), { recursive: true });
        await copyFile(target, backup);
      }
      const temporary = `${target}.update-${randomUUID()}.tmp`;
      await writeFile(temporary, content, { flag: "wx" });
      applied.push({ target, backup, hadTarget });
      try {
        await rm(target, { force: true });
        await rename(temporary, target);
      } catch (error) {
        await rm(temporary, { force: true });
        throw error;
      }
    }
    await writeFile(resolve(updatesRoot, "last-update.json"), `${JSON.stringify({ version: bundle.version, appliedAt: new Date().toISOString(), files: bundle.files.length, backupRoot }, null, 2)}\n`, { mode: 0o600 });
    await rm(pendingPath, { force: true });
    await rm(bundlePath, { force: true });
    return { applied: true, version: bundle.version, files: bundle.files.length, backupRoot };
  } catch (error) {
    for (const item of applied.reverse()) {
      if (item.hadTarget && await exists(item.backup)) await copyFile(item.backup, item.target);
      else await rm(item.target, { force: true });
    }
    throw new Error(`Update rolled back: ${safeError(error, "installation failed")}`);
  }
}

export function createUpdateBundle(root, version, filePaths) {
  const installRoot = resolve(root);
  const files = filePaths.map((path) => {
    const normalized = normalizeManagedPath(path);
    const content = readFileSync(resolve(installRoot, normalized));
    return { path: normalized, bytes: content.byteLength, sha256: sha256(content), base64: content.toString("base64") };
  });
  return { schemaVersion: 1, name: "Outreach Console Lite Update", version: cleanVersion(version), createdAt: new Date().toISOString(), files };
}

export function parseAndValidateBundle(bytes, expectedVersion = "") {
  let bundle;
  try { bundle = JSON.parse(Buffer.from(bytes).toString("utf8")); }
  catch { throw new Error("The update bundle is not valid JSON."); }
  if (bundle?.schemaVersion !== 1 || cleanVersion(bundle.version) !== bundle.version || !Array.isArray(bundle.files) || !bundle.files.length) throw new Error("The update bundle has an invalid manifest.");
  if (expectedVersion && cleanVersion(expectedVersion) !== bundle.version) throw new Error("The update bundle version does not match the selected release.");
  const seen = new Set();
  const validatedFiles = [];
  let decodedBytes = 0;
  for (const file of bundle.files) {
    const path = normalizeManagedPath(file?.path);
    if (seen.has(path)) throw new Error(`The update bundle repeats ${path}.`);
    seen.add(path);
    if (!Number.isInteger(file.bytes) || file.bytes < 0 || file.bytes > maximumBundleBytes || !/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.base64 !== "string") throw new Error(`The update manifest is invalid for ${path}.`);
    const content = Buffer.from(file.base64, "base64");
    decodedBytes += content.byteLength;
    if (decodedBytes > maximumBundleBytes || content.byteLength !== file.bytes || sha256(content) !== file.sha256) throw new Error(`The update file hash is invalid for ${path}.`);
    validatedFiles.push({ path, bytes: file.bytes, sha256: file.sha256, base64: file.base64 });
  }
  return {
    schemaVersion: 1,
    name: "Outreach Console Lite Update",
    version: bundle.version,
    createdAt: typeof bundle.createdAt === "string" && Number.isFinite(Date.parse(bundle.createdAt)) ? new Date(bundle.createdAt).toISOString() : "",
    files: validatedFiles,
  };
}

function managedTarget(root, path) { const normalized = normalizeManagedPath(path); const target = resolve(root, normalized); ensureWithin(root, target); return target; }
function normalizeManagedPath(value) {
  const path = String(value || "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!path || path.includes("\0") || path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").includes("..")) throw new Error("Update path is unsafe.");
  const [first] = path.split("/");
  if (!managedRoots.has(first) && !managedFiles.has(path)) throw new Error(`Update path is not managed by the application: ${path}`);
  return path;
}
function ensureWithin(parent, candidate) { const result = relative(resolve(parent), resolve(candidate)); if (!result || result.startsWith("..") || isAbsolute(result)) { if (resolve(parent) !== resolve(candidate)) throw new Error("Update path escapes its expected directory."); } }
async function assertNoLinks(parent, candidate) {
  const base = resolve(parent);
  const target = resolve(candidate);
  ensureWithin(base, target);
  const segments = relative(base, target).split(/[\\/]+/).filter(Boolean);
  let current = base;
  for (const segment of ["", ...segments]) {
    if (segment) current = resolve(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) throw new Error("Automatic updates refuse symbolic links or junctions in managed paths.");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
  }
}
function normalizeRepository(value) { const text = String(value || "").trim(); if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text)) throw new Error("OUTREACH_UPDATE_REPOSITORY must use owner/repository format."); return text; }
function validateDownloadUrl(value) { const parsed = new URL(String(value || "")); if (parsed.protocol !== "https:" || !allowedDownloadHosts.has(parsed.hostname.toLowerCase()) || parsed.username || parsed.password) throw new Error("The update download URL is not an approved GitHub host."); return parsed.toString(); }
function safeReleaseUrl(value) { try { const parsed = new URL(String(value || "")); return parsed.protocol === "https:" && parsed.hostname === "github.com" ? parsed.toString() : ""; } catch { return ""; } }
function cleanVersion(value) { const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/); return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : ""; }
function compareVersions(left, right) { const a = cleanVersion(left).split(".").map(Number); const b = cleanVersion(right).split(".").map(Number); if (a.length !== 3 || b.length !== 3) return 0; for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
function baseStatus(state, version, detail) { return { state, currentVersion: cleanVersion(version) || "0.0.0", latestVersion: "", releaseName: "", releaseUrl: "", publishedAt: "", detail, canInstall: false, checkedAt: "" }; }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function exists(path) { try { return (await stat(path)).isFile(); } catch (error) { if (error?.code === "ENOENT") return false; throw error; } }
async function readLimitedResponse(response, maximumBytes, label) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new Error(`${label} exceeds the ${Math.round(maximumBytes / 1024 / 1024)} MB safety limit.`);
  if (!response.body) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) throw new Error(`${label} exceeds the ${Math.round(maximumBytes / 1024 / 1024)} MB safety limit.`);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error(`${label} exceeds the ${Math.round(maximumBytes / 1024 / 1024)} MB safety limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
function safeError(error, fallback) { return String(error instanceof Error ? error.message : fallback).replace(/[\r\n\t]/g, " ").slice(0, 500); }
function updateError(status, message) { const error = new Error(message); error.status = status; return error; }
