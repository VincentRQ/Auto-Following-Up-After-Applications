import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyPendingUpdate, createUpdateManager, parseAndValidateBundle } from "./updater.js";

test("update manager accepts only the pinned GitHub release bundle and stages it", async () => {
  const root = await mkdtemp(join(tmpdir(), "outreach-updater-"));
  const content = Buffer.from("new web bundle");
  const bundle = bundleFor("9.9.9", [{ path: "web/index.html", content }]);
  const bytes = Buffer.from(JSON.stringify(bundle));
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("api.github.com")) return new Response(JSON.stringify({
      tag_name: "v9.9.9", name: "Release 9.9.9", html_url: "https://github.com/VincentRQ/Auto-Following-Up-After-Applications/releases/tag/v9.9.9", published_at: "2026-07-31T00:00:00Z",
      assets: [{ name: "outreach-console-update-9.9.9.json", browser_download_url: "https://github.com/VincentRQ/Auto-Following-Up-After-Applications/releases/download/v9.9.9/outreach-console-update-9.9.9.json", digest: `sha256:${hash(bytes)}` }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(bytes, { status: 200, headers: { "content-length": String(bytes.byteLength) } });
  };
  try {
    const manager = createUpdateManager({ root, currentVersion: "1.0.0", fetchImpl });
    const available = await manager.check();
    assert.equal(available.state, "available");
    assert.equal(available.canInstall, true);
    await assert.rejects(() => manager.stage("wrong"), /confirmation/i);
    const staged = await manager.stage("INSTALL AND RESTART");
    assert.equal(staged.state, "ready_to_restart");
    assert.equal(calls.length, 2);
    const pending = JSON.parse(await readFile(join(root, "data", "updates", "pending-update.json"), "utf8"));
    assert.equal(pending.version, "9.9.9");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("pending updates preserve user data and replace only managed application files", async () => {
  const root = await mkdtemp(join(tmpdir(), "outreach-apply-"));
  const updates = join(root, "data", "updates");
  await mkdir(join(root, "web"), { recursive: true });
  await mkdir(updates, { recursive: true });
  await writeFile(join(root, "web", "index.html"), "old");
  await writeFile(join(root, "data", "outreach.sqlite"), "user history");
  const bundlePath = join(updates, "outreach-console-update-2.0.0.json");
  await writeFile(bundlePath, JSON.stringify(bundleFor("2.0.0", [{ path: "web/index.html", content: Buffer.from("new") }, { path: "README.md", content: Buffer.from("updated help") }])));
  await writeFile(join(updates, "pending-update.json"), JSON.stringify({ version: "2.0.0", bundlePath }));
  try {
    const result = await applyPendingUpdate(root);
    assert.equal(result.applied, true);
    assert.equal(await readFile(join(root, "web", "index.html"), "utf8"), "new");
    assert.equal(await readFile(join(root, "README.md"), "utf8"), "updated help");
    assert.equal(await readFile(join(root, "data", "outreach.sqlite"), "utf8"), "user history");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("update checks do not download an equal or older release", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ tag_name: "v1.2.3", assets: [] }), { status: 200 });
  };
  const manager = createUpdateManager({ root: tmpdir(), currentVersion: "1.2.3", fetchImpl });
  const status = await manager.check();
  assert.equal(status.state, "current");
  assert.equal(status.canInstall, false);
  await assert.rejects(() => manager.stage("INSTALL AND RESTART"), /current|available/i);
  assert.equal(calls, 2);
});

test("update downloads reject non-GitHub hosts before making the request", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      tag_name: "v2.0.0",
      assets: [{ name: "outreach-console-update-2.0.0.json", browser_download_url: "https://downloads.example.test/update.json" }],
    }), { status: 200 });
  };
  const manager = createUpdateManager({ root: tmpdir(), currentVersion: "1.0.0", fetchImpl });
  assert.equal((await manager.check()).state, "available");
  await assert.rejects(() => manager.stage("INSTALL AND RESTART"), /approved GitHub host/i);
  assert.equal(calls, 1);
});

test("update checks reject oversized release metadata before parsing it", async () => {
  const fetchImpl = async () => new Response("{}", { status: 200, headers: { "content-length": String(2 * 1024 * 1024) } });
  const manager = createUpdateManager({ root: tmpdir(), currentVersion: "1.0.0", fetchImpl });
  const status = await manager.check();
  assert.equal(status.state, "error");
  assert.match(status.detail, /safety limit/i);
});

test("update downloads reject bundles whose declared size exceeds the limit", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("api.github.com")) return new Response(JSON.stringify({
      tag_name: "v2.0.0",
      assets: [{ name: "outreach-console-update-2.0.0.json", browser_download_url: "https://github.com/VincentRQ/Auto-Following-Up-After-Applications/releases/download/v2.0.0/outreach-console-update-2.0.0.json" }],
    }), { status: 200 });
    return new Response("{}", { status: 200, headers: { "content-length": String(51 * 1024 * 1024) } });
  };
  const manager = createUpdateManager({ root: tmpdir(), currentVersion: "1.0.0", fetchImpl });
  assert.equal((await manager.check()).state, "available");
  await assert.rejects(() => manager.stage("INSTALL AND RESTART"), /safety limit/i);
});

test("a failed file replacement rolls back files already applied", async () => {
  const root = await mkdtemp(join(tmpdir(), "outreach-rollback-"));
  const updates = join(root, "data", "updates");
  await mkdir(updates, { recursive: true });
  await writeFile(join(root, "README.md"), "old help");
  await writeFile(join(root, "web"), "blocks directory creation");
  const bundlePath = join(updates, "outreach-console-update-2.0.0.json");
  await writeFile(bundlePath, JSON.stringify(bundleFor("2.0.0", [
    { path: "README.md", content: Buffer.from("new help") },
    { path: "web/assets/app.js", content: Buffer.from("new app") },
  ])));
  await writeFile(join(updates, "pending-update.json"), JSON.stringify({ version: "2.0.0", bundlePath }));
  try {
    await assert.rejects(() => applyPendingUpdate(root), /rolled back/i);
    assert.equal(await readFile(join(root, "README.md"), "utf8"), "old help");
    assert.equal(await readFile(join(root, "web"), "utf8"), "blocks directory creation");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("pending updates refuse managed paths redirected through a symbolic link or junction", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "outreach-link-root-"));
  const outside = await mkdtemp(join(tmpdir(), "outreach-link-outside-"));
  const updates = join(root, "data", "updates");
  await mkdir(updates, { recursive: true });
  try {
    try { await symlink(outside, join(root, "web"), process.platform === "win32" ? "junction" : "dir"); }
    catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) return context.skip(`Symbolic-link creation is unavailable: ${error.code}`);
      throw error;
    }
    const bundlePath = join(updates, "outreach-console-update-2.0.0.json");
    await writeFile(bundlePath, JSON.stringify(bundleFor("2.0.0", [{ path: "web/index.html", content: Buffer.from("escaped") }])));
    await writeFile(join(updates, "pending-update.json"), JSON.stringify({ version: "2.0.0", bundlePath }));
    await assert.rejects(() => applyPendingUpdate(root), /symbolic links|junctions/i);
    await assert.rejects(() => readFile(join(outside, "index.html")), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("update bundles reject traversal, unmanaged data, duplicate paths, and bad hashes", () => {
  const valid = bundleFor("2.0.0", [{ path: "web/index.html", content: Buffer.from("ok") }]);
  assert.equal(parseAndValidateBundle(Buffer.from(JSON.stringify(valid)), "2.0.0").files.length, 1);
  for (const path of ["../outside.txt", "data/outreach.sqlite", ".env", "C:/outside.txt"]) {
    const unsafe = bundleFor("2.0.0", [{ path, content: Buffer.from("bad") }]);
    assert.throws(() => parseAndValidateBundle(Buffer.from(JSON.stringify(unsafe)), "2.0.0"), /unsafe|not managed/i);
  }
  const duplicate = bundleFor("2.0.0", [{ path: "README.md", content: Buffer.from("one") }, { path: "README.md", content: Buffer.from("two") }]);
  assert.throws(() => parseAndValidateBundle(Buffer.from(JSON.stringify(duplicate)), "2.0.0"), /repeats/i);
  const badHash = bundleFor("2.0.0", [{ path: "README.md", content: Buffer.from("one") }]);
  badHash.files[0].sha256 = "0".repeat(64);
  assert.throws(() => parseAndValidateBundle(Buffer.from(JSON.stringify(badHash)), "2.0.0"), /hash/i);
});

function bundleFor(version, inputs) {
  return { schemaVersion: 1, name: "Outreach Console Lite Update", version, createdAt: new Date().toISOString(), files: inputs.map(({ path, content }) => ({ path, bytes: content.byteLength, sha256: hash(content), base64: content.toString("base64") })) };
}
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
