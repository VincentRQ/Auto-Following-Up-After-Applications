-- Outreach Console external storage schema for MySQL 8+ or MariaDB 10.6+.
-- Run this in a private database, then connect it through the documented adapter.

CREATE TABLE IF NOT EXISTS workspace_snapshots (
  workspace_id VARCHAR(80) PRIMARY KEY,
  snapshot_version INT NOT NULL,
  snapshot_json JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  normalized_name VARCHAR(500) NOT NULL UNIQUE,
  domain VARCHAR(500) NOT NULL DEFAULT '',
  suppression_reason TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  source_row_id VARCHAR(500) NOT NULL,
  external_id VARCHAR(500) NOT NULL DEFAULT '',
  role_title VARCHAR(500) NOT NULL,
  job_url TEXT NOT NULL,
  profile VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'applied',
  status_updated_at DATETIME(3) NULL,
  status_source VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_jobs_source (company_id, profile, source_row_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contacts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(500) NOT NULL,
  title VARCHAR(500) NOT NULL DEFAULT '',
  email VARCHAR(320) NOT NULL,
  linkedin_url TEXT NOT NULL,
  external_key VARCHAR(500) NOT NULL DEFAULT '',
  source VARCHAR(200) NOT NULL DEFAULT '',
  confidence DOUBLE NOT NULL DEFAULT 0,
  tier TINYINT NOT NULL DEFAULT 3,
  suppressed_at DATETIME(3) NULL,
  suppression_reason TEXT NOT NULL,
  last_contacted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_contacts_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT chk_contact_tier CHECK (tier BETWEEN 1 AND 3),
  UNIQUE KEY uq_contacts_email (company_id, email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS runs (
  id VARCHAR(300) PRIMARY KEY,
  mode VARCHAR(50) NOT NULL,
  profile VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  request_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  replay_of VARCHAR(300) NOT NULL DEFAULT ''
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS run_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  run_id VARCHAR(300) NOT NULL,
  job_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  state VARCHAR(50) NOT NULL,
  plan_json JSON NOT NULL,
  CONSTRAINT fk_run_items_run FOREIGN KEY (run_id) REFERENCES runs(id),
  CONSTRAINT fk_run_items_job FOREIGN KEY (job_id) REFERENCES jobs(id),
  CONSTRAINT fk_run_items_company FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY uq_run_job (run_id, job_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS outreach_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  job_id BIGINT UNSIGNED NULL,
  contact_id BIGINT UNSIGNED NULL,
  profile VARCHAR(100) NOT NULL DEFAULT '',
  channel VARCHAR(50) NOT NULL DEFAULT 'email',
  status VARCHAR(50) NOT NULL,
  subject VARCHAR(500) NOT NULL DEFAULT '',
  external_id VARCHAR(500) NOT NULL DEFAULT '',
  occurred_at DATETIME(3) NOT NULL,
  metadata_json JSON NOT NULL,
  CONSTRAINT fk_history_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_history_job FOREIGN KEY (job_id) REFERENCES jobs(id),
  CONSTRAINT fk_history_contact FOREIGN KEY (contact_id) REFERENCES contacts(id),
  KEY idx_history_company (company_id, occurred_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exceptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  job_id BIGINT UNSIGNED NULL,
  contact_id BIGINT UNSIGNED NULL,
  type VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'open',
  severity VARCHAR(50) NOT NULL DEFAULT 'normal',
  evidence_json JSON NOT NULL,
  proposed_action_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  resolved_at DATETIME(3) NULL,
  CONSTRAINT fk_exceptions_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_exceptions_job FOREIGN KEY (job_id) REFERENCES jobs(id),
  CONSTRAINT fk_exceptions_contact FOREIGN KEY (contact_id) REFERENCES contacts(id),
  KEY idx_exceptions_state (state, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mailbox_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account VARCHAR(200) NOT NULL,
  provider_message_id VARCHAR(500) NOT NULL,
  received_at DATETIME(3) NULL,
  sender_name VARCHAR(500) NOT NULL DEFAULT '',
  sender_email VARCHAR(320) NOT NULL DEFAULT '',
  subject VARCHAR(500) NOT NULL,
  preview TEXT NOT NULL,
  classification VARCHAR(100) NOT NULL,
  proposed_status VARCHAR(100) NOT NULL,
  confidence DOUBLE NOT NULL,
  company_id BIGINT UNSIGNED NULL,
  job_id BIGINT UNSIGNED NULL,
  match_confidence DOUBLE NOT NULL DEFAULT 0,
  state VARCHAR(50) NOT NULL DEFAULT 'unmatched',
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_mailbox_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_mailbox_job FOREIGN KEY (job_id) REFERENCES jobs(id),
  UNIQUE KEY uq_mailbox_message (account, provider_message_id),
  KEY idx_mailbox_state (state, received_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS message_drafts (
  id VARCHAR(300) PRIMARY KEY,
  job_source_row_id VARCHAR(500) NOT NULL,
  profile VARCHAR(100) NOT NULL,
  company VARCHAR(500) NOT NULL,
  role_title VARCHAR(500) NOT NULL DEFAULT '',
  recipient_name VARCHAR(500) NOT NULL DEFAULT '',
  recipient_email VARCHAR(320) NOT NULL DEFAULT '',
  recipient_title VARCHAR(500) NOT NULL DEFAULT '',
  writing_mode VARCHAR(50) NOT NULL DEFAULT 'manual',
  status VARCHAR(50) NOT NULL DEFAULT 'needs_writing',
  subject VARCHAR(500) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  prompt_override TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_drafts_profile (profile, updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS provider_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(200) NOT NULL,
  operation VARCHAR(200) NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  credit_count DOUBLE NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  occurred_at DATETIME(3) NOT NULL,
  metadata_json JSON NOT NULL,
  KEY idx_usage_time (occurred_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS system_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  level VARCHAR(50) NOT NULL,
  category VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  correlation_id VARCHAR(500) NOT NULL DEFAULT '',
  context_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_logs_time (created_at)
) ENGINE=InnoDB;
