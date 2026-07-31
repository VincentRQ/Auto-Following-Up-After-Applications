-- Outreach Console external storage schema for PostgreSQL 14+.
-- Run this in a private database, then connect it through the documented adapter.

BEGIN;

CREATE TABLE IF NOT EXISTS workspace_snapshots (
  workspace_id VARCHAR(80) PRIMARY KEY,
  snapshot_version INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL DEFAULT '',
  suppression_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  source_row_id TEXT NOT NULL,
  external_id TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL,
  job_url TEXT NOT NULL DEFAULT '',
  profile TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  status_updated_at TIMESTAMPTZ,
  status_source TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, profile, source_row_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  linkedin_url TEXT NOT NULL DEFAULT '',
  external_key TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  tier INTEGER NOT NULL DEFAULT 3 CHECK (tier BETWEEN 1 AND 3),
  suppressed_at TIMESTAMPTZ,
  suppression_reason TEXT NOT NULL DEFAULT '',
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, email)
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  profile TEXT NOT NULL,
  status TEXT NOT NULL,
  request_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  replay_of TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS run_items (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  job_id BIGINT NOT NULL REFERENCES jobs(id),
  company_id BIGINT NOT NULL REFERENCES companies(id),
  state TEXT NOT NULL,
  plan_json JSONB NOT NULL,
  UNIQUE(run_id, job_id)
);

CREATE TABLE IF NOT EXISTS outreach_history (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  job_id BIGINT REFERENCES jobs(id),
  contact_id BIGINT REFERENCES contacts(id),
  profile TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS exceptions (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  job_id BIGINT REFERENCES jobs(id),
  contact_id BIGINT REFERENCES contacts(id),
  type TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'normal',
  evidence_json JSONB NOT NULL,
  proposed_action_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mailbox_events (
  id BIGSERIAL PRIMARY KEY,
  account TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  received_at TIMESTAMPTZ,
  sender_name TEXT NOT NULL DEFAULT '',
  sender_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL,
  proposed_status TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  company_id BIGINT REFERENCES companies(id),
  job_id BIGINT REFERENCES jobs(id),
  match_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'unmatched',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account, provider_message_id)
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
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_usage (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  credit_count DOUBLE PRECISION NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  correlation_id TEXT NOT NULL DEFAULT '',
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id, tier, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_history_company ON outreach_history(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_exceptions_state ON exceptions(state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailbox_state ON mailbox_events(state, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_profile ON message_drafts(profile, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_time ON provider_usage(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_time ON system_logs(created_at DESC);

COMMIT;
