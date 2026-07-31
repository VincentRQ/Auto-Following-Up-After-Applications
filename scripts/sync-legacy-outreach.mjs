#!/usr/bin/env node
/**
 * One-way, idempotent reconciliation from the established outreach CSV ledger
 * into the local company-centric CRM. This never sends email or spends credits.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../backend/database.js";
import { createService } from "../backend/service.js";

const here = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaults = {
  database: resolve(here, "data", "outreach.sqlite"),
  legacyRoot: process.env.OUTREACH_LEGACY_ROOT ?? "",
};

const args = parseArgs(process.argv.slice(2));
const configuredLegacyRoot = args["legacy-root"] || defaults.legacyRoot;
if (!configuredLegacyRoot) throw new Error("Set OUTREACH_LEGACY_ROOT or pass --legacy-root <path> before importing a legacy outreach ledger.");
const legacyRoot = resolve(configuredLegacyRoot);
const activityLog = resolve(args["activity-log"] || `${legacyRoot}/crm/outreach_activity_log.csv`);
const databasePath = resolve(args.database || defaults.database);
if (!existsSync(activityLog)) throw new Error(`Activity ledger was not found: ${activityLog}`);

const activity = parseCsv(readFileSync(activityLog, "utf8"));
const sourceCache = new Map();
const jobsByKey = new Map();
for (const event of activity) {
  const sourceRow = resolveSourceRow(event, sourceCache);
  const job = sourceRow ? jobFromSource(sourceRow, event) : jobFromEvent(event);
  const key = jobKey(job);
  if (!jobsByKey.has(key)) jobsByKey.set(key, job);
}

if (args["dry-run"]) {
  console.log(JSON.stringify({ dryRun: true, activityEvents: activity.length, jobs: jobsByKey.size, activityLog, databasePath }, null, 2));
  process.exit(0);
}

const db = openDatabase(databasePath);
const service = createService(db);
const applications = [];
const existing = new Map();
for (const [key, job] of jobsByKey) {
  const prior = findExistingJob(db, job);
  if (prior) existing.set(key, prior.id);
  else applications.push({ ...job, source_row_id: `legacy-${hash(key).slice(0, 20)}` });
}
const importedApplications = service.importApplications({ applications, source: "legacy_outreach_reconciliation" });

const jobIds = new Map(existing);
for (const [key, job] of jobsByKey) {
  if (jobIds.has(key)) continue;
  const row = db.prepare(`SELECT j.id FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE c.normalized_name = ? AND j.profile = ? AND j.source_row_id = ?`).get(normalizeCompany(job.company), job.profile, `legacy-${hash(key).slice(0, 20)}`);
  if (row) jobIds.set(key, row.id);
}

const contacts = [];
const outreach = [];
for (const event of activity) {
  const sourceRow = resolveSourceRow(event, sourceCache);
  const job = sourceRow ? jobFromSource(sourceRow, event) : jobFromEvent(event);
  const status = normalizeStatus(event);
  const externalId = `legacy-${hash(JSON.stringify(event))}`;
  contacts.push({
    company: job.company,
    contact_name: event.contact_name || sourceRow?.full_name || "Unknown contact",
    contact_email: event.contact_email || sourceRow?.email || "",
    title: sourceRow?.title || "",
    linkedin_url: sourceRow?.linkedin_url || "",
    source: sourceRow?.email_source || "outreach_activity_log",
    confidence: sourceRow?.email_status === "verified" ? 0.98 : 0.75,
    tier: Number(sourceRow?.title_tier || 3),
    contact_key: event.contact_email || `${job.company}|${event.contact_name}`,
  });
  outreach.push({
    company: job.company,
    contact_email: event.contact_email || sourceRow?.email || "",
    profile: job.profile,
    status,
    event_type: event.event_type || "",
    subject: event.subject || "",
    occurred_at: toIso(event.event_date),
    external_id: externalId,
    source: "outreach_activity_log",
    notes: event.notes || "",
    job_database_id: jobIds.get(jobKey(job)) || null,
  });
}
const history = service.importHistorical({ contacts, outreach, source: "legacy_outreach_reconciliation" });
console.log(JSON.stringify({ activityEvents: activity.length, jobs: jobsByKey.size, importedApplications, history, databasePath, activityLog }, null, 2));

function resolveSourceRow(event, cache) {
  const rawFile = event.source_file || "";
  if (!rawFile || !rawFile.toLowerCase().endsWith(".csv")) return null;
  const candidates = [resolve(rawFile), resolve(legacyRoot, rawFile)];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return null;
  if (!cache.has(file)) cache.set(file, parseCsv(readFileSync(file, "utf8")));
  return cache.get(file).find((row) => normalizeCompany(row.company) === normalizeCompany(event.company) && String(row.email || "").toLowerCase() === String(event.contact_email || "").toLowerCase()) || null;
}

function jobFromSource(row, event) {
  return {
    company: row.company || event.company,
    company_domain: row.company_domain || "",
    profile: normalizeProfile(row.profile || event.account),
    role_title: row.role_title || roleFromSubject(event.subject),
    job_id: row.job_id || "",
    job_url: row.job_url || "",
    applied_at: event.event_date || "",
  };
}

function jobFromEvent(event) {
  return {
    company: event.company || "Unknown company",
    company_domain: "",
    profile: normalizeProfile(event.account),
    role_title: roleFromSubject(event.subject),
    job_id: "",
    job_url: "",
    applied_at: event.event_date || "",
  };
}

function findExistingJob(db, job) {
  const params = [normalizeCompany(job.company), job.profile];
  if (job.job_id) return db.prepare(`SELECT j.* FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE c.normalized_name = ? AND j.profile = ? AND j.external_id = ? ORDER BY j.id LIMIT 1`).get(...params, job.job_id);
  if (job.job_url) return db.prepare(`SELECT j.* FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE c.normalized_name = ? AND j.profile = ? AND j.job_url = ? ORDER BY j.id LIMIT 1`).get(...params, job.job_url);
  return db.prepare(`SELECT j.* FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE c.normalized_name = ? AND j.profile = ? AND j.role_title = ? ORDER BY j.id LIMIT 1`).get(...params, job.role_title);
}

function normalizeStatus(event) {
  const status = String(event.status || "").toLowerCase();
  const type = String(event.event_type || "").toLowerCase();
  if (type.includes("bounce") || status.includes("bounce") || status === "failed") return "bounced";
  if (type.includes("human_reply") || type === "reply_received" || status === "replied") return "replied";
  if (type === "reply_sent" || type === "sent" || status === "sent") return "sent";
  if (status === "rejected") return "rejected";
  if (status === "drafted" || status === "scheduled" || status === "cancelled") return status;
  return "delivered";
}

function roleFromSubject(subject = "") {
  const legacy = subject.match(/follow-up on my (.+?) application(?:\s*-\s*.+)?$/i);
  const compact = subject.match(/following up on (.+?)(?:\s*\([^)]*\))?$/i);
  return (legacy?.[1] || compact?.[1] || "Applied role").trim();
}
function jobKey(job) { return `${normalizeCompany(job.company)}|${job.profile}|${job.job_id || job.job_url || job.role_title.toLowerCase()}`; }
function normalizeCompany(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function normalizeProfile(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "ba" || text === "business analyst") return "business_analyst";
  if (text === "da" || text === "data analyst") return "data_analyst";
  return text.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "default_profile";
}
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function toIso(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? `${value}T12:00:00.000Z` : value || new Date().toISOString(); }
function parseArgs(values) { const output = {}; for (let index = 0; index < values.length; index += 1) { const item = values[index]; if (!item.startsWith("--")) continue; const key = item.slice(2); output[key] = values[index + 1]?.startsWith("--") || values[index + 1] === undefined ? true : values[++index]; } return output; }
function parseCsv(text) { const rows = []; let row = []; let cell = ""; let quoted = false; for (let index = 0; index < text.length; index += 1) { const char = text[index]; if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; } else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; } else cell += char; } if (cell || row.length) { row.push(cell); rows.push(row); } const [headers = [], ...data] = rows; return data.map((values) => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ""), values[index] ?? ""]))); }
