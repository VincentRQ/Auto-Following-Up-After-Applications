import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./database.js";
import { createService } from "./service.js";
import { loadConfig } from "./config.js";
import { createProviders } from "./providers.js";

export function createOutreachServer({
  providers = createProviders(loadConfig()),
  databasePath,
  allowedOrigins = parseAllowedOrigins(process.env.OUTREACH_ALLOWED_ORIGINS),
  maximumBodyBytes = Number(process.env.OUTREACH_MAX_BODY_BYTES ?? 2 * 1024 * 1024),
} = {}) {
  maximumBodyBytes = Number.isFinite(maximumBodyBytes) ? Math.max(1024, Math.min(maximumBodyBytes, 20 * 1024 * 1024)) : 2 * 1024 * 1024;
  const resolvedDatabasePath = providers?.publicSampleMode === true
    ? ":memory:"
    : databasePath ?? process.env.OUTREACH_DATABASE ?? "data/outreach.sqlite";
  const db = openDatabase(resolvedDatabasePath);
  const service = createService(db, providers);
  const server = createServer(async (request, response) => {
    const origin = String(request.headers.origin ?? "");
    if (origin && !allowedOrigins.has(origin)) return send(response, 403, { error: "Browser origin is not allowed" });
    setCorsHeaders(response, origin);
    if (request.method === "OPTIONS") return send(response, 204, null);
    try {
      const url = new URL(request.url, "http://localhost");
      if (request.method === "GET" && url.pathname === "/api/health") return send(response, 200, service.health());
      if (request.method === "GET" && url.pathname === "/api/providers/check") return send(response, 200, await service.providerCheck());
      if (request.method === "POST" && url.pathname === "/api/batches") return send(response, 201, service.submitBatch(await body(request, maximumBodyBytes)));
      if (request.method === "POST" && url.pathname === "/api/import/applications") return send(response, 201, service.importApplications(await body(request, maximumBodyBytes)));
      if (request.method === "POST" && url.pathname === "/api/import/history") return send(response, 201, service.importHistorical(await body(request, maximumBodyBytes)));
      if (request.method === "GET" && url.pathname === "/api/dashboard") return send(response, 200, service.dashboard());
      if (request.method === "GET" && url.pathname === "/api/incidents/report") return send(response, 200, service.incidentReport());
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
      return send(response, 404, { error: "Not found" });
    } catch (error) {
      return send(response, error.status ?? 500, { error: error.message ?? "Internal error" });
    }
  });
  server.on("close", () => db.close());
  return server;
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
  return new Set(configured.length ? configured : ["http://127.0.0.1:5177", "http://localhost:5177"]);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.OUTREACH_PORT ?? 43127);
  createOutreachServer().listen(port, "127.0.0.1", () => console.log(`Outreach backend: http://127.0.0.1:${port}`));
}
