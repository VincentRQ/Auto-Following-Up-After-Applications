import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./database.js";
import { createService } from "./service.js";
import { loadConfig } from "./config.js";
import { createProviders } from "./providers.js";

export function createOutreachServer({
  providers = createProviders(loadConfig()),
  databasePath,
  staticRoot = process.env.OUTREACH_STATIC_ROOT ?? "",
  allowedOrigins = parseAllowedOrigins(process.env.OUTREACH_ALLOWED_ORIGINS),
  maximumBodyBytes = Number(process.env.OUTREACH_MAX_BODY_BYTES ?? 2 * 1024 * 1024),
  updateManager = null,
  onRestartRequested = null,
} = {}) {
  maximumBodyBytes = Number.isFinite(maximumBodyBytes) ? Math.max(1024, Math.min(maximumBodyBytes, 20 * 1024 * 1024)) : 2 * 1024 * 1024;
  const resolvedDatabasePath = providers?.publicSampleMode === true
    ? ":memory:"
    : databasePath ?? process.env.OUTREACH_DATABASE ?? "data/outreach.sqlite";
  const db = openDatabase(resolvedDatabasePath);
  const service = createService(db, providers, { databasePath: resolvedDatabasePath });
  const resolvedStaticRoot = staticRoot ? resolve(staticRoot) : "";
  const staticConnectSources = providers?.publicSampleMode === true
    ? "'self'"
    : "'self' http://127.0.0.1:* http://localhost:*";
  const server = createServer(async (request, response) => {
    const origin = String(request.headers.origin ?? "");
    if (origin && !allowedOrigins.has(origin)) return send(response, 403, { error: "Browser origin is not allowed" });
    setCorsHeaders(response, origin);
    if (request.method === "OPTIONS") return send(response, 204, null);
    try {
      const url = new URL(request.url, "http://localhost");
      if (request.method === "GET" && url.pathname === "/api/health") return send(response, 200, service.health());
      if (request.method === "GET" && url.pathname === "/api/updates/status") return send(response, 200, updateStatus(updateManager, providers));
      if (request.method === "POST" && url.pathname === "/api/updates/check") {
        if (providers?.publicSampleMode === true) throw httpError(403, "Automatic updates are disabled in Public Sample Mode");
        if (!updateManager) return send(response, 200, updateStatus(null, providers));
        return send(response, 200, await updateManager.check());
      }
      if (request.method === "POST" && url.pathname === "/api/updates/install") {
        if (providers?.publicSampleMode === true) throw httpError(403, "Automatic updates are disabled in Public Sample Mode");
        if (!updateManager || typeof onRestartRequested !== "function") throw httpError(409, "Automatic installation is available only in the downloaded Lite release");
        const result = await updateManager.stage((await body(request, maximumBodyBytes)).confirmation);
        send(response, 202, result);
        setTimeout(() => onRestartRequested(), 250);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/providers/check") return send(response, 200, await service.providerCheck());
      if (request.method === "POST" && url.pathname === "/api/batches") return send(response, 201, service.submitBatch(await body(request, maximumBodyBytes)));
      if (request.method === "POST" && url.pathname === "/api/import/applications") return send(response, 201, service.importApplications(await body(request, maximumBodyBytes)));
      if (request.method === "POST" && url.pathname === "/api/import/history") return send(response, 201, service.importHistorical(await body(request, maximumBodyBytes)));
      if (request.method === "GET" && url.pathname === "/api/dashboard") return send(response, 200, service.dashboard());
      if (request.method === "GET" && url.pathname === "/api/incidents/report") return send(response, 200, service.incidentReport());
      if (request.method === "POST" && url.pathname === "/api/system/reset/preview") return send(response, 200, service.previewWorkspaceReset());
      if (request.method === "POST" && url.pathname === "/api/system/reset") return send(response, 200, service.resetWorkspace(await body(request, maximumBodyBytes)));
      if (request.method === "GET" && url.pathname === "/api/setup/status") return send(response, 200, service.setupStatus());
      if (request.method === "POST" && url.pathname === "/api/setup/integrations") return send(response, 200, service.configureIntegrations(await body(request, maximumBodyBytes)));
      if (request.method === "GET" && url.pathname === "/api/writing/drafts") return send(response, 200, { drafts: service.listMessageDrafts(url.searchParams.get("profile") ?? "") });
      if (request.method === "POST" && url.pathname === "/api/writing/drafts") return send(response, 201, service.saveMessageDraft(await body(request, maximumBodyBytes)));
      if (request.method === "POST" && url.pathname === "/api/writing/check") return send(response, 200, await service.checkAiConnection(await body(request, maximumBodyBytes)));
      if (request.method === "POST" && url.pathname === "/api/writing/generate") return send(response, 200, await service.generateMessages(await body(request, maximumBodyBytes)));
      if (request.method === "GET" && url.pathname === "/api/crm/companies") return send(response, 200, { companies: service.listCompanies() });
      const companyMatch = url.pathname.match(/^\/api\/crm\/companies\/(\d+)$/);
      if (request.method === "GET" && companyMatch) return send(response, 200, service.getCompany(companyMatch[1]));
      const contactMatch = url.pathname.match(/^\/api\/crm\/companies\/(\d+)\/contacts$/);
      if (request.method === "POST" && contactMatch) return send(response, 201, service.addContact(contactMatch[1], await body(request, maximumBodyBytes)));
      const outreachMatch = url.pathname.match(/^\/api\/crm\/companies\/(\d+)\/outreach$/);
      if (request.method === "POST" && outreachMatch) return send(response, 201, service.recordOutreach(outreachMatch[1], await body(request, maximumBodyBytes)));
      const suppressionMatch = url.pathname.match(/^\/api\/crm\/companies\/(\d+)\/suppression$/);
      if (request.method === "POST" && suppressionMatch) return send(response, 200, service.setCompanySuppression(suppressionMatch[1], await body(request, maximumBodyBytes)));
      const enrichmentMatch = url.pathname.match(/^\/api\/crm\/companies\/(\d+)\/enrich$/);
      if (request.method === "POST" && enrichmentMatch) return send(response, 200, await service.enrichCompany(enrichmentMatch[1], await body(request, maximumBodyBytes)));
      if (request.method === "GET" && url.pathname === "/api/exceptions") return send(response, 200, { exceptions: service.listExceptions() });
      if (request.method === "POST" && url.pathname === "/api/exceptions") return send(response, 201, service.recordException(await body(request, maximumBodyBytes)));
      const exceptionMatch = url.pathname.match(/^\/api\/exceptions\/(\d+)\/resolve$/);
      if (request.method === "POST" && exceptionMatch) return send(response, 200, service.resolveException(exceptionMatch[1], await body(request, maximumBodyBytes)));
      if (request.method === "GET" && url.pathname === "/api/mailbox/events") return send(response, 200, { events: service.listMailboxEvents(url.searchParams.get("state") ?? "") });
      if (request.method === "POST" && url.pathname === "/api/mailbox/sync") return send(response, 200, await service.syncMailbox(await body(request, maximumBodyBytes)));
      const mailboxReviewMatch = url.pathname.match(/^\/api\/mailbox\/events\/(\d+)\/review$/);
      if (request.method === "POST" && mailboxReviewMatch) return send(response, 200, service.reviewMailboxEvent(mailboxReviewMatch[1], await body(request, maximumBodyBytes)));
      if (request.method === "POST" && url.pathname === "/api/outreach/drafts") return send(response, 201, await service.createEmailDraft(await body(request, maximumBodyBytes)));
      if (request.method === "POST" && url.pathname === "/api/outreach/send") return send(response, 200, await service.sendEmail(await body(request, maximumBodyBytes)));
      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (request.method === "GET" && runMatch) return send(response, 200, service.getRun(runMatch[1]));
      const replayMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/replay$/);
      if (request.method === "POST" && replayMatch) return send(response, 201, service.replayRun(replayMatch[1]));
      if (resolvedStaticRoot && (request.method === "GET" || request.method === "HEAD")) {
        const served = await serveStatic(request, response, url.pathname, resolvedStaticRoot, staticConnectSources);
        if (served) return;
      }
      return send(response, 404, { error: "Not found" });
    } catch (error) {
      return send(response, error.status ?? 500, { error: error.message ?? "Internal error" });
    }
  });
  server.on("close", () => db.close());
  return server;
}

function updateStatus(updateManager, providers) {
  if (providers?.publicSampleMode === true) return { state: "unsupported", currentVersion: "", latestVersion: "", releaseName: "", releaseUrl: "", publishedAt: "", detail: "Automatic updates are disabled in Public Sample Mode.", canInstall: false, checkedAt: "" };
  return updateManager?.status() ?? { state: "unsupported", currentVersion: "", latestVersion: "", releaseName: "", releaseUrl: "", publishedAt: "", detail: "Automatic updates are available only in the downloaded Lite release.", canInstall: false, checkedAt: "" };
}

function send(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(value === null ? "" : JSON.stringify(value));
}
async function body(request, maximumBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw httpError(413, `Request body exceeds ${maximumBytes} bytes`);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw httpError(400, "Request body must be valid JSON");
  }
}

function setCorsHeaders(response, origin) {
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
}

function parseAllowedOrigins(value = "") {
  const configured = String(value).split(",").map((item) => item.trim()).filter(Boolean);
  return new Set(configured.length ? configured : [
    "http://127.0.0.1:5177",
    "http://localhost:5177",
    "http://127.0.0.1:43127",
    "http://localhost:43127",
  ]);
}

async function serveStatic(request, response, rawPathname, root, connectSources) {
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    throw httpError(400, "Request path is not valid UTF-8");
  }
  if (pathname.includes("\0")) throw httpError(400, "Request path is invalid");
  const relativeName = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = resolve(root, relativeName);
  if (!isWithin(root, filePath)) throw httpError(403, "Static path is outside the application bundle");

  let details = await fileStat(filePath);
  if (details?.isDirectory()) {
    filePath = resolve(filePath, "index.html");
    if (!isWithin(root, filePath)) throw httpError(403, "Static path is outside the application bundle");
    details = await fileStat(filePath);
  }
  if (!details?.isFile()) return false;

  const canonicalRoot = await realpath(root);
  const canonicalFile = await realpath(filePath);
  if (!isWithin(canonicalRoot, canonicalFile)) throw httpError(403, "Static path is outside the application bundle");
  const contents = await readFile(canonicalFile);
  const extension = extname(filePath).toLowerCase();
  const immutable = relativeName.startsWith("assets/") && /-[a-zA-Z0-9_-]{6,}\./.test(relativeName);
  response.writeHead(200, {
    "Content-Type": contentType(extension),
    "Content-Length": String(contents.length),
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectSources}; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(request.method === "HEAD" ? "" : contents);
  return true;
}

async function fileStat(path) {
  try {
    return await stat(path);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function isWithin(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

function contentType(extension) {
  return ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  })[extension] ?? "application/octet-stream";
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.OUTREACH_PORT ?? 43127);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("OUTREACH_PORT must be an integer from 1024 through 65535.");
  createOutreachServer().listen(port, "127.0.0.1", () => console.log(`Outreach backend: http://127.0.0.1:${port}`));
}
