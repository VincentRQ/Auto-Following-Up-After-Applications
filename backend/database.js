import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const WORKSPACE_TABLES = [
  "outreach_attempts",
  "run_items",
  "exceptions",
  "mailbox_events",
  "outreach_history",
  "events",
  "message_drafts",
  "provider_usage",
  "system_logs",
  "runs",
  "contacts",
  "jobs",
  "companies",
];

export function openDatabase(path = "data/outreach.sqlite") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  ensureColumn(db, "jobs", "status", "TEXT NOT NULL DEFAULT 'applied'");
  ensureColumn(db, "jobs", "status_updated_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "jobs", "status_source", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "contacts", "linkedin_url", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "contacts", "external_key", "TEXT NOT NULL DEFAULT ''");
  return db;
}

export function workspaceRecordCounts(db) {
  return Object.fromEntries(WORKSPACE_TABLES.map((table) => [table, Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)]));
}

export function backupAndResetWorkspace(db, databasePath = ":memory:") {
  const deleted = workspaceRecordCounts(db);
  let backupFile = "";
  if (databasePath !== ":memory:") {
    const absoluteDatabase = resolve(databasePath);
    const backupDirectory = join(dirname(absoluteDatabase), "backups");
    mkdirSync(backupDirectory, { recursive: true });
    const extension = extname(absoluteDatabase) || ".sqlite";
    const stem = basename(absoluteDatabase, extension);
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17);
    let candidate = join(backupDirectory, `${stem}-before-reset-${timestamp}${extension}`);
    let suffix = 1;
    while (existsSync(candidate)) candidate = join(backupDirectory, `${stem}-before-reset-${timestamp}-${suffix++}${extension}`);
    db.exec("PRAGMA wal_checkpoint(FULL)");
    db.exec(`VACUUM INTO '${candidate.replaceAll("'", "''")}'`);
    backupFile = basename(candidate);
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of WORKSPACE_TABLES) db.exec(`DELETE FROM ${table}`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { deleted, backupCreated: Boolean(backupFile), backupFile };
}

function ensureColumn(db, table, column, definition) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL DEFAULT '',
  suppression_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  source_row_id TEXT NOT NULL,
  external_id TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL,
  job_url TEXT NOT NULL DEFAULT '',
  profile TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(company_id, profile, source_row_id)
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  tier INTEGER NOT NULL DEFAULT 3,
  suppressed_at TEXT NOT NULL DEFAULT '',
  suppression_reason TEXT NOT NULL DEFAULT '',
  last_contacted_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(company_id, email)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  profile TEXT NOT NULL,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT '',
  replay_of TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS run_items (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  state TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  UNIQUE(run_id, job_id)
);
CREATE TABLE IF NOT EXISTS outreach_attempts (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  state TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_receipt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outreach_history (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  job_id INTEGER REFERENCES jobs(id),
  contact_id INTEGER REFERENCES contacts(id),
  profile TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS exceptions (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  job_id INTEGER REFERENCES jobs(id),
  contact_id INTEGER REFERENCES contacts(id),
  type TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'normal',
  evidence_json TEXT NOT NULL,
  proposed_action_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mailbox_events (
  id INTEGER PRIMARY KEY,
  account TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT '',
  sender_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL,
  proposed_status TEXT NOT NULL,
  confidence REAL NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  job_id INTEGER REFERENCES jobs(id),
  match_confidence REAL NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'unmatched',
  created_at TEXT NOT NULL,
  UNIQUE(account, provider_message_id)
);
CREATE TABLE IF NOT EXISTS provider_usage (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  credit_count REAL NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 1,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  correlation_id TEXT NOT NULL DEFAULT '',
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS message_drafts (
  id TEXT PRIMARY KEY,
  job_source_row_id TEXT NOT NULL,
  profile TEXT NOT NULL,
  company TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT '',
  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL DEFAULT '',
  recipient_title TEXT NOT NULL DEFAULT '',
  writing_mode TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'needs_writing',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  prompt_override TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id, id);
CREATE INDEX IF NOT EXISTS idx_exceptions_state ON exceptions(state, created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id, tier, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_history_company ON outreach_history(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailbox_state ON mailbox_events(state, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_time ON provider_usage(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_time ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_profile ON message_drafts(profile, updated_at DESC);
`;
