import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

import { classifyMailboxMessage } from "./providers.js";
import { backupAndResetWorkspace, workspaceRecordCounts } from "./database.js";

export function createService(db, providers = null, { databasePath = ":memory:" } = {}) {
  const resetConfirmations = new Map();
  return {
    health: () => ({
      status: "ok",
      message: "Local outreach backend is ready.",
      providers: { database: "ready", ...(providers?.status() ?? { enrichment: "shadow", mailbox: "shadow" }) },
    }),

    submitBatch(payload) {
      validateBatch(payload);
      const runId = `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const now = isoNow();
      db.prepare("INSERT INTO runs (id, mode, profile, status, request_json, created_at) VALUES (?, 'shadow', ?, 'running', ?, ?)")
        .run(runId, payload.profile, JSON.stringify(payload), now);

      const items = [];
      for (const row of payload.queue) {
        const company = upsertCompany(db, row.company);
        const job = upsertJob(db, company.id, row, payload.profile);
        const contacts = ensureShadowContacts(db, company, payload.contact_target ?? 3);
        const selected = selectContacts(db, company.id, payload.contact_target ?? 3, now);
        const plan = {
          companyId: company.id,
          jobId: job.id,
          contacts: selected.map(publicContact),
          drafts: selected.map((contact) => ({
            contactId: contact.id,
            to: contact.email,
            subject: `${row.role_title} (${row.job_id || "job application"})`,
            state: "shadow_only",
          })),
          blocked: selected.length === 0,
          reason: selected.length ? "" : "No eligible contacts after suppression and rotation rules.",
        };
        db.prepare("INSERT INTO run_items (run_id, job_id, company_id, state, plan_json) VALUES (?, ?, ?, ?, ?)")
          .run(runId, job.id, company.id, plan.blocked ? "blocked" : "planned", JSON.stringify(plan));
        appendEvent(db, runId, "run_item", String(job.id), "shadow_plan_created", plan);
        items.push({ source_row_id: row.source_row_id, company: company.name, ...plan, seededContacts: contacts });
      }
      db.prepare("UPDATE runs SET status = 'completed', completed_at = ? WHERE id = ?").run(isoNow(), runId);
      appendEvent(db, runId, "run", runId, "shadow_run_completed", { itemCount: items.length });
      return { run_id: runId, mode: "shadow", status: "completed", items };
    },

    importApplications(payload) {
      if (!Array.isArray(payload?.applications)) throw httpError(400, "applications array is required");
      let imported = 0;
      for (const [index, row] of payload.applications.entries()) {
        if (!row.company || !row.role_title) continue;
        const company = upsertCompany(db, row.company);
        if (row.company_domain && !company.domain) db.prepare("UPDATE companies SET domain = ? WHERE id = ?").run(row.company_domain.toLowerCase(), company.id);
        const profile = normalizeProfile(row.profile);
        const sourceRow = row.source_row_id || `${payload.source || "import"}-${index}-${row.job_id || row.role_title}`;
        const job = upsertJob(db, company.id, { source_row_id: sourceRow, job_id: row.job_id || "", role_title: row.role_title, job_url: row.job_url || "" }, profile);
        db.prepare("UPDATE jobs SET status_updated_at = ?, status_source = ? WHERE id = ? AND status = 'applied' AND status_updated_at = ''")
          .run(row.applied_at || isoNow(), payload.source || "application_import", job.id);
        imported += 1;
      }
      return { imported, companies: db.prepare("SELECT COUNT(*) AS count FROM companies").get().count, jobs: db.prepare("SELECT COUNT(*) AS count FROM jobs").get().count };
    },

    importHistorical(payload) {
      const contacts = Array.isArray(payload?.contacts) ? payload.contacts : [];
      const outreach = Array.isArray(payload?.outreach) ? payload.outreach : [];
      let contactsSaved = 0; let outreachSaved = 0; let skipped = 0;
      db.exec("BEGIN");
      try {
        for (const row of contacts) {
          if (!row.company || (!row.contact_email?.includes("@") && !row.contact_name && !row.linkedin_url)) { skipped += 1; continue; }
          const company = upsertCompany(db, row.company);
          const placeholder = `legacy-${fingerprint(row.contact_key || `${row.company}|${row.contact_name}|${row.linkedin_url}`).slice(0, 16)}@local.invalid`;
          const input = { name: row.contact_name || row.contact_email || "Unknown contact", title: row.title || row.role_family || "", email: row.contact_email || placeholder, source: row.source || "legacy_recruiter_workbook", confidence: Number(row.confidence ?? 0.65), tier: Number(row.tier ?? 3), linkedin_url: row.linkedin_url || "", external_key: row.contact_key || "" };
          saveContact(db, company.id, input); contactsSaved += 1;
        }
        for (const row of outreach) {
          let company = row.company ? upsertCompany(db, row.company) : null;
          const contact = row.contact_email ? db.prepare("SELECT * FROM contacts WHERE email = ? ORDER BY id LIMIT 1").get(row.contact_email.toLowerCase()) : null;
          if (!company && contact) company = requireCompany(db, contact.company_id);
          if (!company) { skipped += 1; continue; }
          const job = row.job_database_id ? requireJob(db, company.id, row.job_database_id) : null;
          const externalId = row.external_id || `${row.account || ""}|${row.contact_email || ""}|${row.subject || ""}|${row.occurred_at || row.event_date || ""}`;
          if (db.prepare("SELECT id FROM outreach_history WHERE external_id = ? LIMIT 1").get(externalId)) continue;
          const status = row.status || row.event_type || "sent";
          const occurredAt = validDate(row.occurred_at || row.event_date) ?? isoNow();
          db.prepare(`INSERT INTO outreach_history (company_id, job_id, contact_id, profile, channel, status, subject, external_id, occurred_at, metadata_json)
            VALUES (?, ?, ?, ?, 'email', ?, ?, ?, ?, ?)`)
            .run(company.id, job?.id ?? null, contact?.id ?? null, normalizeProfile(row.profile || row.account), status, row.subject || "", externalId, occurredAt, JSON.stringify({ source: row.source || payload.source || "legacy_history", notes: row.notes || "", event_type: row.event_type || "" }));
          if (contact && ["sent", "delivered", "replied"].includes(status)) db.prepare("UPDATE contacts SET last_contacted_at = ? WHERE id = ?").run(occurredAt, contact.id);
          if (job && ["sent", "replied", "rejected"].includes(status)) updateJobStatus(db, job.id, status, payload.source || "legacy_history", occurredAt);
          outreachSaved += 1;
        }
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      writeLog(db, "info", "import", "Historical CRM import completed", "", { contactsSaved, outreachSaved, skipped, source: payload.source || "" });
      return { contactsSaved, outreachSaved, skipped };
    },

    dashboard() {
      const statuses = db.prepare("SELECT status, COUNT(*) AS count FROM jobs GROUP BY status ORDER BY count DESC").all();
      const outreachStatuses = db.prepare("SELECT status, COUNT(*) AS count FROM outreach_history GROUP BY status ORDER BY count DESC").all();
      const activity7 = db.prepare("SELECT COUNT(*) AS count FROM outreach_history WHERE occurred_at >= datetime('now', '-7 days')").get().count;
      const activity30 = db.prepare("SELECT COUNT(*) AS count FROM outreach_history WHERE occurred_at >= datetime('now', '-30 days')").get().count;
      const usage = db.prepare("SELECT provider, operation, SUM(request_count) AS requests, SUM(credit_count) AS credits, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures FROM provider_usage GROUP BY provider, operation ORDER BY provider, operation").all();
      return { statuses, outreachStatuses, activity: { last7Days: activity7, last30Days: activity30, dailyAverage7: activity7 / 7, dailyAverage30: activity30 / 30 }, usage, totals: { companies: db.prepare("SELECT COUNT(*) AS count FROM companies").get().count, contacts: db.prepare("SELECT COUNT(*) AS count FROM contacts").get().count, jobs: db.prepare("SELECT COUNT(*) AS count FROM jobs").get().count } };
    },

    incidentReport() {
      return { generatedAt: isoNow(), health: this.health(), dashboard: this.dashboard(), openExceptions: this.listExceptions().filter((item) => item.state === "open"), unmatchedMailbox: this.listMailboxEvents("unmatched"), recentLogs: db.prepare("SELECT * FROM system_logs ORDER BY id DESC LIMIT 200").all().map(parseLog) };
    },

    previewWorkspaceReset() {
      const now = Date.now();
      for (const [token, expiresAt] of resetConfirmations) if (expiresAt <= now) resetConfirmations.delete(token);
      const token = randomUUID();
      const expiresAt = now + 5 * 60 * 1000;
      resetConfirmations.set(token, expiresAt);
      return {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        counts: workspaceRecordCounts(db),
        backupPlanned: databasePath !== ":memory:",
        preserved: ["source spreadsheets and resumes", "provider and CLI credentials", "local provider configuration", "external databases"],
      };
    },

    resetWorkspace(input) {
      const token = String(input?.token ?? "");
      const expiresAt = resetConfirmations.get(token) ?? 0;
      resetConfirmations.delete(token);
      if (!token || expiresAt <= Date.now()) throw httpError(409, "Reset preview expired or was already used. Open Start fresh again.");
      if (input?.confirmation !== "START FRESH") throw httpError(409, "Type START FRESH exactly to clear local application history.");
      const result = backupAndResetWorkspace(db, databasePath);
      return {
        resetAt: isoNow(),
        ...result,
        preserved: ["source spreadsheets and resumes", "provider and CLI credentials", "local provider configuration", "external databases"],
      };
    },

    setupStatus() {
      return { publicSampleMode: providers?.publicSampleMode === true, liveSendEnabled: providers?.liveSendEnabled === true, profiles: Object.entries(providers?.profiles ?? {}).map(([profile, value]) => ({ profile, account: value.account || "", resumeConfigured: Boolean(value.resume && existsSync(value.resume)) })), providerStatus: providers?.status() ?? {}, integrations: providers?.integrations?.(), providers: providers?.describe?.() ?? [] };
    },

    configureIntegrations(input) {
      if (!providers?.configure) throw httpError(501, "This backend does not support integration preferences");
      const result = providers.configure(input);
      writeLog(db, "info", "setup", "Integration preferences updated", "", { providers: result.providers.map((item) => ({ role: item.role, providerId: item.providerId, status: item.status })) });
      return result;
    },

    async checkAiConnection(input) {
      if (!providers?.checkAi) throw httpError(503, "AI connection checks are not available");
      const result = await providers.checkAi(input ?? {});
      writeLog(db, result.status === "ready" ? "info" : "warning", "setup", "AI connection checked", "", { mode: result.mode, status: result.status, installed: result.installed, authenticated: result.authenticated });
      return result;
    },

    listMessageDrafts(profile = "") {
      const sql = `SELECT * FROM message_drafts ${profile ? "WHERE profile = ?" : ""} ORDER BY updated_at DESC LIMIT 1000`;
      return profile ? db.prepare(sql).all(profile) : db.prepare(sql).all();
    },

    saveMessageDraft(input) {
      const draft = normalizeMessageDraft(input);
      db.prepare(`INSERT INTO message_drafts
        (id, job_source_row_id, profile, company, role_title, recipient_name, recipient_email, recipient_title, writing_mode, status, subject, body, prompt_override, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET recipient_name=excluded.recipient_name, recipient_email=excluded.recipient_email,
          recipient_title=excluded.recipient_title, writing_mode=excluded.writing_mode, status=excluded.status,
          subject=excluded.subject, body=excluded.body, prompt_override=excluded.prompt_override, updated_at=excluded.updated_at`)
        .run(draft.id, draft.jobRowId, draft.profile, draft.company, draft.roleTitle, draft.recipientName, draft.recipientEmail, draft.recipientTitle, draft.mode, draft.status, draft.subject, draft.body, draft.promptOverride, draft.updatedAt);
      return db.prepare("SELECT * FROM message_drafts WHERE id = ?").get(draft.id);
    },

    async generateMessages(input) {
      if (!providers?.generateMessages) throw httpError(503, "Writing adapter is not configured");
      if (!input?.brief || !Array.isArray(input.drafts) || !input.drafts.length) throw httpError(400, "brief and a non-empty drafts array are required");
      if (input.drafts.length > 100) throw httpError(400, "A writing request is limited to 100 drafts");
      const allowedIds = new Set(input.drafts.map((item) => String(item.id)));
      const maximumWords = Math.max(20, Math.min(500, Number(input.maximum_words) || 80));
      const generated = await providers.generateMessages({
        brief: String(input.brief).slice(0, 200_000),
        maximum_words: maximumWords,
        drafts: input.drafts.map((item) => normalizeMessageDraft(item)),
        ai_connection: input.ai_connection ?? {},
      });
      if (!Array.isArray(generated)) throw httpError(502, "Writing adapter returned an invalid response");
      if (generated.length !== input.drafts.length) throw httpError(502, "Writing adapter did not return exactly one message per draft");
      const returnedIds = new Set();
      const messages = generated.slice(0, input.drafts.length).map((item) => {
        const id = String(item?.draft_id ?? item?.id ?? "");
        if (!allowedIds.has(id)) throw httpError(502, "Writing adapter returned an unknown draft ID");
        if (returnedIds.has(id)) throw httpError(502, "Writing adapter returned a duplicate draft ID");
        returnedIds.add(id);
        const subject = String(item?.subject ?? "").trim().slice(0, 500);
        const body = String(item?.body ?? "").trim().slice(0, 20_000);
        if (!subject || !body) throw httpError(502, `Writing adapter returned an incomplete message for ${id}`);
        const words = body.split(/\s+/).filter(Boolean).length;
        return { draft_id: id, subject, body, words, over_limit: words > maximumWords };
      });
      for (const message of messages) {
        const original = input.drafts.find((item) => item.id === message.draft_id);
        this.saveMessageDraft({ ...original, subject: message.subject, body: message.body, status: "ready", updatedAt: isoNow() });
      }
      writeUsage(db, "writing_adapter", "generate_messages", 1, 0, true, { drafts: messages.length, maximumWords });
      return { messages };
    },

    listCompanies() {
      const companies = db.prepare(`
        SELECT c.*, COUNT(DISTINCT j.id) AS job_count, COUNT(DISTINCT ct.id) AS contact_count,
          MAX(ct.last_contacted_at) AS last_contacted_at
        FROM companies c
        LEFT JOIN jobs j ON j.company_id = c.id
        LEFT JOIN contacts ct ON ct.company_id = c.id
        GROUP BY c.id ORDER BY c.updated_at DESC
      `).all();
      return companies.map((company) => ({ ...company, contacts: db.prepare("SELECT * FROM contacts WHERE company_id = ? ORDER BY tier, confidence DESC").all(company.id) }));
    },

    getCompany(companyId) {
      const company = requireCompany(db, companyId);
      return {
        ...company,
        jobs: db.prepare("SELECT * FROM jobs WHERE company_id = ? ORDER BY created_at DESC").all(company.id),
        contacts: db.prepare("SELECT * FROM contacts WHERE company_id = ? ORDER BY suppressed_at != '', tier, confidence DESC").all(company.id),
        outreach: db.prepare(`SELECT h.*, ct.name AS contact_name, ct.email AS contact_email, j.role_title, j.external_id AS job_external_id
          FROM outreach_history h LEFT JOIN contacts ct ON ct.id = h.contact_id LEFT JOIN jobs j ON j.id = h.job_id
          WHERE h.company_id = ? ORDER BY h.occurred_at DESC, h.id DESC`).all(company.id).map(parseHistory),
        exceptions: db.prepare("SELECT * FROM exceptions WHERE company_id = ? ORDER BY created_at DESC").all(company.id).map(parseException),
        events: db.prepare("SELECT * FROM events WHERE entity_type = 'company' AND entity_id = ? ORDER BY created_at DESC, id DESC LIMIT 100").all(String(company.id)).map(parseEvent),
      };
    },

    addContact(companyId, input) {
      const company = requireCompany(db, companyId);
      validateContact(input);
      const result = db.prepare(`INSERT INTO contacts
        (company_id, name, title, email, source, confidence, tier, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id, email) DO UPDATE SET name = excluded.name, title = excluded.title,
          source = excluded.source, confidence = excluded.confidence, tier = excluded.tier`)
        .run(company.id, input.name.trim(), input.title?.trim() ?? "", input.email.trim().toLowerCase(), input.source?.trim() || "manual", clampConfidence(input.confidence), clampTier(input.tier), isoNow());
      const contact = db.prepare("SELECT * FROM contacts WHERE company_id = ? AND email = ?").get(company.id, input.email.trim().toLowerCase());
      appendEvent(db, `company-${company.id}`, "company", String(company.id), result.changes ? "contact_saved" : "contact_unchanged", publicContact(contact));
      return publicContact(contact);
    },

    recordOutreach(companyId, input) {
      const company = requireCompany(db, companyId);
      if (!input?.status) throw httpError(400, "status is required");
      const allowed = new Set(["drafted", "scheduled", "sent", "delivered", "replied", "bounced", "rejected", "cancelled"]);
      if (!allowed.has(input.status)) throw httpError(400, "unsupported outreach status");
      const contact = input.contact_id ? requireContact(db, company.id, input.contact_id) : null;
      const job = input.job_id ? requireJob(db, company.id, input.job_id) : null;
      const occurredAt = validDate(input.occurred_at) ?? isoNow();
      const result = db.prepare(`INSERT INTO outreach_history
        (company_id, job_id, contact_id, profile, channel, status, subject, external_id, occurred_at, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(company.id, job?.id ?? null, contact?.id ?? null, input.profile ?? "", input.channel ?? "email", input.status, input.subject ?? "", input.external_id ?? "", occurredAt, JSON.stringify(input.metadata ?? {}));
      if (contact && ["sent", "delivered", "replied"].includes(input.status)) {
        db.prepare("UPDATE contacts SET last_contacted_at = ? WHERE id = ?").run(occurredAt, contact.id);
      }
      const history = db.prepare("SELECT * FROM outreach_history WHERE id = ?").get(Number(result.lastInsertRowid));
      appendEvent(db, `company-${company.id}`, "company", String(company.id), `outreach_${input.status}`, { historyId: history.id, contactId: contact?.id ?? null, jobId: job?.id ?? null, occurredAt });
      return parseHistory(history);
    },

    setCompanySuppression(companyId, input) {
      const company = requireCompany(db, companyId);
      const reason = input?.suppressed === false ? "" : String(input?.reason || "manual suppression").trim();
      db.prepare("UPDATE companies SET suppression_reason = ?, updated_at = ? WHERE id = ?").run(reason, isoNow(), company.id);
      appendEvent(db, `company-${company.id}`, "company", String(company.id), reason ? "company_suppressed" : "company_unsuppressed", { reason });
      return { id: company.id, suppressed: Boolean(reason), suppression_reason: reason };
    },

    listExceptions() {
      return db.prepare(`
        SELECT e.*, c.name AS company_name, ct.name AS contact_name, ct.email AS contact_email
        FROM exceptions e JOIN companies c ON c.id = e.company_id
        LEFT JOIN contacts ct ON ct.id = e.contact_id
        ORDER BY CASE e.state WHEN 'open' THEN 0 ELSE 1 END, e.created_at DESC
      `).all().map(parseException);
    },

    recordException(input) {
      if (!input?.company || !input?.type) throw httpError(400, "company and type are required");
      const company = upsertCompany(db, input.company);
      const contact = input.email ? findOrCreateContact(db, company.id, input) : null;
      const consecutiveFailures = countRecentFailures(db, company.id) + (isFailure(input.type) ? 1 : 0);
      const action = recoveryAction(input, consecutiveFailures);
      if (input.type === "hard_bounce" && contact) suppressContact(db, contact.id, "hard bounce");
      if (input.type === "positive_reply") suppressCompany(db, company.id, "human reply received");
      if (input.type === "human_reply") suppressCompany(db, company.id, "human reply received");
      if (input.type === "next_steps") suppressCompany(db, company.id, "company requested next steps");
      const severity = consecutiveFailures >= 4 ? "warning" : action.severity;
      const result = db.prepare(`
        INSERT INTO exceptions (company_id, contact_id, type, severity, evidence_json, proposed_action_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(company.id, contact?.id ?? null, input.type, severity, JSON.stringify(input), JSON.stringify({ ...action, consecutiveFailures }), isoNow());
      const exceptionId = Number(result.lastInsertRowid);
      appendEvent(db, `exception-${exceptionId}`, "company", String(company.id), input.type, { ...input, action, consecutiveFailures });
      return { id: exceptionId, company: company.name, contact: contact ? publicContact(contact) : null, proposedAction: action, consecutiveFailures, fourFailureWarning: consecutiveFailures >= 4 };
    },

    resolveException(exceptionId, input) {
      const item = db.prepare(`SELECT e.*, c.name AS company_name FROM exceptions e JOIN companies c ON c.id = e.company_id WHERE e.id = ?`).get(exceptionId);
      if (!item) throw httpError(404, "Exception not found");
      if (item.state !== "open") throw httpError(409, "Exception is already resolved");
      const resolution = input?.resolution;
      if (!["completed", "dismissed", "deferred"].includes(resolution)) throw httpError(400, "resolution must be completed, dismissed, or deferred");
      const proposedAction = JSON.parse(item.proposed_action_json);
      if (resolution === "completed" && ["draft_redirect", "draft_referral"].includes(proposedAction.kind) && proposedAction.target) {
        findOrCreateContact(db, item.company_id, { email: proposedAction.target, name: proposedAction.target, title: "Referred contact" });
      }
      const state = resolution === "deferred" ? "deferred" : "resolved";
      db.prepare("UPDATE exceptions SET state = ?, resolved_at = ? WHERE id = ?").run(state, isoNow(), item.id);
      appendEvent(db, `exception-${item.id}`, "company", String(item.company_id), "exception_resolved", { resolution, note: input.note ?? "", proposedAction });
      return { id: item.id, state, resolution, company: item.company_name, proposedAction };
    },

    async providerCheck() {
      if (!providers) throw httpError(503, "Provider adapters are not configured");
      const result = await providers.check(); writeUsage(db, "setup", "provider_check", 1, 0, !result.errors?.length, { errors: result.errors ?? [] }); return result;
    },

    async enrichCompany(companyId, input = {}) {
      if (!providers) throw httpError(503, "Provider adapters are not configured");
      const company = requireCompany(db, companyId);
      const job = input.job_id ? requireJob(db, company.id, input.job_id) : db.prepare("SELECT * FROM jobs WHERE company_id = ? ORDER BY created_at DESC LIMIT 1").get(company.id);
      const result = await providers.enrich({ company: company.name, domain: company.domain, profile: job?.profile ?? input.profile, roleTitle: job?.role_title ?? "", jobId: job?.external_id ?? "", jobUrl: job?.job_url ?? "", maxContacts: input.max_contacts ?? 3, spendCredits: input.spend_credits === true });
      const enrichmentName = providers?.integrations?.().primaryEnrichment?.providerId ?? "contact_provider";
      writeUsage(db, enrichmentName, input.spend_credits ? "search_and_unlock" : "people_search", 1, input.spend_credits ? result.contacts.length : 0, true, { company: company.name, estimatedCredits: input.spend_credits });
      let saved = 0;
      for (const row of result.contacts) {
        if (!row.full_name || !row.email || row.draft_ready !== "yes") continue;
        this.addContact(company.id, { name: row.full_name, title: row.title, email: row.email, source: row.email_source || enrichmentName, confidence: row.email_status === "verified" ? 0.98 : 0.75, tier: Math.min(3, Number(row.title_tier) || 3) });
        saved += 1;
      }
      appendEvent(db, `company-${company.id}`, "company", String(company.id), "enrichment_completed", { rows: result.contacts.length, saved, paidLookups: result.paidLookups });
      return { ...result, savedContacts: saved };
    },

    listMailboxEvents(state = "") {
      if (state === "attention") {
        return db.prepare(`SELECT m.*, c.name AS company_name, j.role_title FROM mailbox_events m
          LEFT JOIN companies c ON c.id = m.company_id LEFT JOIN jobs j ON j.id = m.job_id
          WHERE (m.classification IN ('interview', 'human_reply') AND m.state NOT IN ('dismissed', 'reviewed')) OR m.state = 'unmatched'
          ORDER BY CASE WHEN m.classification = 'interview' THEN 0 WHEN m.classification = 'human_reply' THEN 1 ELSE 2 END,
            m.received_at DESC, m.id DESC LIMIT 500`).all();
      }
      const sql = `SELECT m.*, c.name AS company_name, j.role_title FROM mailbox_events m LEFT JOIN companies c ON c.id = m.company_id LEFT JOIN jobs j ON j.id = m.job_id ${state ? "WHERE m.state = ?" : ""} ORDER BY m.received_at DESC, m.id DESC LIMIT 500`;
      return state ? db.prepare(sql).all(state) : db.prepare(sql).all();
    },

    async syncMailbox(input = {}) {
      if (!providers) throw httpError(503, "Provider adapters are not configured");
      const accounts = input.accounts?.length ? providers.accounts.filter((item) => input.accounts.includes(item.alias)) : providers.accounts;
      const output = []; const errors = [];
      for (const account of accounts) {
        let messages;
        try {
          messages = await providers.recentMailbox(account.alias, input.top ?? 100);
          writeUsage(db, providers?.integrations?.().mailbox?.providerId ?? "mailbox_provider", "mailbox_sync", 1, 0, true, { account: account.alias, messages: messages.length });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ account: account.alias, message });
          writeUsage(db, providers?.integrations?.().mailbox?.providerId ?? "mailbox_provider", "mailbox_sync", 1, 0, false, { account: account.alias, message });
          writeLog(db, "error", "mailbox", "Mailbox account sync failed", `mailbox-${account.alias}`, { account: account.alias, message });
          continue;
        }
        for (const message of messages) {
          const ingested = ingestMailboxMessage(db, account, message, input.apply !== false);
          output.push(ingested);
          if (input.apply !== false && ingested.state === "matched" && ["hard_bounce", "ooo", "human_reply", "interview"].includes(ingested.classification)) {
            const existing = db.prepare("SELECT id FROM exceptions WHERE evidence_json LIKE ? LIMIT 1").get(`%${message.id}%`);
            if (!existing) {
              const company = db.prepare("SELECT name FROM companies WHERE id = ?").get(ingested.companyId);
              const failedEmail = ingested.classification === "hard_bounce" ? extractEmail(message.preview) : message.from_email;
              this.recordException({ company: company.name, type: ingested.classification === "interview" ? "next_steps" : ingested.classification, email: failedEmail, name: message.from_name, mailbox_message_id: message.id, subject: message.subject, preview: message.preview });
            }
          }
        }
      }
      repairCrossProfileMailboxStates(db, providers.accounts);
      return { scanned: output.length, inserted: output.filter((item) => item.inserted).length, matched: output.filter((item) => item.state === "matched").length, unmatched: output.filter((item) => item.state === "unmatched").length, errors, events: output };
    },

    reviewMailboxEvent(eventId, input) {
      const event = db.prepare("SELECT * FROM mailbox_events WHERE id = ?").get(Number(eventId));
      if (!event) throw httpError(404, "Mailbox event not found");
      const company = input.company_id ? requireCompany(db, input.company_id) : null;
      const job = input.job_id ? requireJob(db, company?.id, input.job_id) : null;
      const state = input.dismissed ? "dismissed" : job ? "matched" : "reviewed";
      db.prepare("UPDATE mailbox_events SET company_id = ?, job_id = ?, state = ?, match_confidence = ? WHERE id = ?").run(company?.id ?? null, job?.id ?? null, state, job ? 1 : 0, event.id);
      if (job && input.apply_status !== false && event.proposed_status !== "unknown") updateJobStatus(db, job.id, event.proposed_status, `mailbox:${event.account}`, event.received_at || isoNow());
      return { id: event.id, state, company_id: company?.id ?? null, job_id: job?.id ?? null };
    },

    async createEmailDraft(input) {
      if (!providers) throw httpError(503, "Provider adapters are not configured");
      const context = outreachContext(db, providers, input);
      const result = await providers.createDraft(context);
      const mailboxProvider = providers?.integrations?.().mailbox?.providerId ?? "mailbox_provider";
      writeUsage(db, mailboxProvider, "draft", 1, 0, true, { account: context.account });
      this.recordOutreach(context.company.id, { contact_id: context.contact.id, job_id: context.job.id, profile: context.job.profile, status: "drafted", subject: context.subject, external_id: result.id ?? "", metadata: { provider: mailboxProvider, account: context.account } });
      return { created: true, draft_id: result.id ?? "", web_link: result.web_link ?? "", account: context.account, company: context.company.name, recipient: context.contact.email };
    },

    async sendEmail(input) {
      if (input?.approval !== "SEND_APPROVED") throw httpError(409, "Explicit SEND_APPROVED token is required");
      if (!providers?.liveSendEnabled) throw httpError(403, "Live sending is disabled for this server session");
      const context = outreachContext(db, providers, input);
      const result = await providers.send(context);
      const mailboxProvider = providers?.integrations?.().mailbox?.providerId ?? "mailbox_provider";
      this.recordOutreach(context.company.id, { contact_id: context.contact.id, job_id: context.job.id, profile: context.job.profile, status: "sent", subject: context.subject, external_id: result.id ?? "", metadata: { provider: mailboxProvider, account: context.account } });
      return { sent: true, account: context.account, company: context.company.name, recipient: context.contact.email, provider_message_id: result.id ?? "" };
    },

    getRun(runId) {
      const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId);
      if (!run) throw httpError(404, "Run not found");
      return hydrateRun(db, run);
    },

    replayRun(runId) {
      const original = this.getRun(runId);
      const replay = this.submitBatch(original.request);
      db.prepare("UPDATE runs SET replay_of = ? WHERE id = ?").run(runId, replay.run_id);
      const current = this.getRun(replay.run_id);
      return {
        replay_run_id: replay.run_id,
        original_run_id: runId,
        equivalent: stablePlans(original.items) === stablePlans(current.items),
        original_items: original.items,
        replay_items: current.items,
      };
    },
  };
}

function normalizeMessageDraft(input) {
  if (!input?.id || !input?.jobRowId || !input?.profile || !input?.company) throw httpError(400, "draft id, jobRowId, profile, and company are required");
  const email = String(input.recipientEmail ?? "").trim().toLowerCase();
  if (email && (!email.includes("@") || email.length > 320)) throw httpError(400, "recipient email is invalid");
  return {
    id: String(input.id).slice(0, 300),
    jobRowId: String(input.jobRowId).slice(0, 300),
    profile: String(input.profile).slice(0, 100),
    company: String(input.company).slice(0, 500),
    roleTitle: String(input.roleTitle ?? "").slice(0, 500),
    recipientName: String(input.recipientName ?? "").slice(0, 500),
    recipientEmail: email,
    recipientTitle: String(input.recipientTitle ?? "").slice(0, 500),
    mode: String(input.mode ?? "manual").slice(0, 50),
    status: String(input.status ?? "needs_writing").slice(0, 50),
    subject: String(input.subject ?? "").slice(0, 500),
    body: String(input.body ?? "").slice(0, 20_000),
    promptOverride: String(input.promptOverride ?? "").slice(0, 20_000),
    updatedAt: validDate(input.updatedAt) ?? isoNow(),
  };
}

function upsertCompany(db, name) {
  const normalized = normalizeCompany(name);
  if (!normalized) throw httpError(400, "company is required");
  const now = isoNow();
  db.prepare(`INSERT INTO companies (name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(normalized_name) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`).run(name.trim(), normalized, now, now);
  return db.prepare("SELECT * FROM companies WHERE normalized_name = ?").get(normalized);
}

function upsertJob(db, companyId, row, profile) {
  db.prepare(`INSERT INTO jobs (company_id, source_row_id, external_id, role_title, job_url, profile, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(company_id, profile, source_row_id)
    DO UPDATE SET external_id = excluded.external_id, role_title = excluded.role_title, job_url = excluded.job_url`)
    .run(companyId, row.source_row_id, row.job_id ?? "", row.role_title, row.job_url ?? "", profile, isoNow());
  return db.prepare("SELECT * FROM jobs WHERE company_id = ? AND profile = ? AND source_row_id = ?").get(companyId, profile, row.source_row_id);
}

function ensureShadowContacts(db, company, target) {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM contacts WHERE company_id = ?").get(company.id).count;
  for (let index = existing; index < target; index += 1) {
    const tier = index === 0 ? 1 : index === 1 ? 2 : 3;
    db.prepare(`INSERT OR IGNORE INTO contacts
      (company_id, name, title, email, source, confidence, tier, created_at)
      VALUES (?, ?, ?, ?, 'shadow-fixture', ?, ?, ?)`)
      .run(company.id, `Shadow Contact ${index + 1}`, tier === 1 ? "Talent Acquisition" : tier === 2 ? "People Operations" : "HR", `shadow-${company.id}-${index + 1}@example.invalid`, 0.9 - index * 0.1, tier, isoNow());
  }
  return Math.max(0, target - existing);
}

function selectContacts(db, companyId, target, now) {
  const company = db.prepare("SELECT suppression_reason FROM companies WHERE id = ?").get(companyId);
  if (company.suppression_reason) return [];
  const cutoff = new Date(new Date(now).getTime() - SIX_MONTHS_MS).toISOString();
  return db.prepare(`SELECT * FROM contacts WHERE company_id = ? AND suppressed_at = ''
    ORDER BY CASE WHEN last_contacted_at = '' OR last_contacted_at < ? THEN 0 ELSE 1 END,
      tier ASC, confidence DESC, last_contacted_at ASC LIMIT ?`).all(companyId, cutoff, target);
}

function findOrCreateContact(db, companyId, input) {
  const normalized = { ...input, name: input.name || input.email };
  validateContact(normalized);
  db.prepare(`INSERT OR IGNORE INTO contacts (company_id, name, title, email, source, confidence, tier, created_at)
    VALUES (?, ?, ?, ?, 'exception', 0.5, 3, ?)`)
    .run(companyId, normalized.name, normalized.title || "", normalized.email.toLowerCase(), isoNow());
  return db.prepare("SELECT * FROM contacts WHERE company_id = ? AND email = ?").get(companyId, input.email.toLowerCase());
}
function saveContact(db, companyId, input) {
  validateContact(input);
  db.prepare(`INSERT INTO contacts (company_id, name, title, email, source, confidence, tier, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(company_id, email) DO UPDATE SET name=excluded.name, title=excluded.title, source=excluded.source, confidence=excluded.confidence, tier=excluded.tier`)
    .run(companyId, input.name.trim(), input.title?.trim() ?? "", input.email.trim().toLowerCase(), input.source || "manual", clampConfidence(input.confidence), clampTier(input.tier), isoNow());
  db.prepare("UPDATE contacts SET linkedin_url = ?, external_key = ? WHERE company_id = ? AND email = ?").run(input.linkedin_url || "", input.external_key || "", companyId, input.email.trim().toLowerCase());
  return db.prepare("SELECT * FROM contacts WHERE company_id = ? AND email = ?").get(companyId, input.email.trim().toLowerCase());
}

function recoveryAction(input, failures) {
  if (input.type === "ooo_redirect" && input.redirect_email) return { kind: "draft_redirect", target: input.redirect_email, note: `Mention referral by ${input.name || "the original contact"}.`, severity: "normal" };
  if (input.type === "hard_bounce") return { kind: "replace_contact", target: "next eligible contact", severity: failures >= 4 ? "warning" : "normal" };
  if (input.type === "positive_reply") return { kind: "suppress_company_outreach", target: input.company, severity: "normal" };
  if (input.type === "human_reply") return { kind: "review_reply_and_suppress_company", target: input.company, severity: "normal" };
  if (input.type === "next_steps") return { kind: "candidate_follow_up_required", target: input.company, note: "Review the response and complete the requested next step.", severity: "warning" };
  if (input.type === "ooo") return { kind: "find_alternate_contact", target: input.company, severity: "normal" };
  if (input.type === "wrong_person" && input.redirect_email) return { kind: "draft_referral", target: input.redirect_email, severity: "normal" };
  if (input.type === "provider_limit") return { kind: "pause_provider", target: input.provider || "affected provider", severity: "warning" };
  return { kind: "manual_review", target: input.company, severity: "normal" };
}

function countRecentFailures(db, companyId) {
  return db.prepare("SELECT COUNT(*) AS count FROM exceptions WHERE company_id = ? AND type IN ('hard_bounce', 'invalid_email') AND state = 'open'").get(companyId).count;
}
function requireCompany(db, id) { const row = db.prepare("SELECT * FROM companies WHERE id = ?").get(Number(id)); if (!row) throw httpError(404, "Company not found"); return row; }
function requireContact(db, companyId, id) { const row = db.prepare("SELECT * FROM contacts WHERE id = ? AND company_id = ?").get(Number(id), companyId); if (!row) throw httpError(404, "Contact not found for company"); return row; }
function requireJob(db, companyId, id) { const row = db.prepare("SELECT * FROM jobs WHERE id = ? AND company_id = ?").get(Number(id), companyId); if (!row) throw httpError(404, "Job not found for company"); return row; }
function validateContact(input) {
  const name = String(input?.name ?? "").trim();
  const email = String(input?.email ?? "").trim();
  if (!name || name.length > 500 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, "contact name and valid email are required");
  }
}
function clampConfidence(value) { const number = Number(value ?? 0.5); return Math.max(0, Math.min(1, Number.isFinite(number) ? number : 0.5)); }
function clampTier(value) { const number = Number(value ?? 3); return [1, 2, 3].includes(number) ? number : 3; }
function validDate(value) { if (!value) return null; const date = new Date(value); if (Number.isNaN(date.getTime())) throw httpError(400, "occurred_at must be a valid date"); return date.toISOString(); }
function extractEmail(value) { return String(value ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ""; }
function ingestMailboxMessage(db, account, message, apply) {
  const classification = classifyMailboxMessage(message);
  const match = matchMailboxToJob(db, message, account.profile);
  const isMatched = Boolean(match.job && match.confidence >= 0.8);
  const state = isMatched ? "matched" : classification.type === "other" ? "ignored" : "unmatched";
  const before = db.prepare("SELECT id FROM mailbox_events WHERE account = ? AND provider_message_id = ?").get(account.alias, message.id);
  const previous = db.prepare("SELECT job_id, state FROM mailbox_events WHERE account = ? AND provider_message_id = ?").get(account.alias, message.id);
  db.prepare(`INSERT INTO mailbox_events (account, provider_message_id, received_at, sender_name, sender_email, subject, preview, classification, proposed_status, confidence, company_id, job_id, match_confidence, state, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account, provider_message_id) DO UPDATE SET classification=excluded.classification, proposed_status=excluded.proposed_status, confidence=excluded.confidence, company_id=excluded.company_id, job_id=excluded.job_id, match_confidence=excluded.match_confidence, state=CASE WHEN mailbox_events.state IN ('reviewed','dismissed') THEN mailbox_events.state ELSE excluded.state END`)
    .run(account.alias, message.id, message.received ?? "", message.from_name ?? "", message.from_email ?? "", message.subject ?? "", message.preview ?? "", classification.type, classification.status, classification.confidence, isMatched ? match.company?.id ?? null : null, isMatched ? match.job?.id ?? null : null, match.confidence, state, isoNow());
  if (previous?.job_id && (!isMatched || previous.job_id !== match.job?.id)) refreshJobStatusFromEvidence(db, previous.job_id);
  const row = db.prepare("SELECT * FROM mailbox_events WHERE account = ? AND provider_message_id = ?").get(account.alias, message.id);
  if (apply && row.state === "matched" && classification.status !== "unknown") updateJobStatus(db, row.job_id, classification.status, `mailbox:${account.alias}`, message.received || isoNow());
  return { id: row.id, inserted: !before, account: account.alias, subject: row.subject, classification: row.classification, proposedStatus: row.proposed_status, state: row.state, companyId: row.company_id, jobId: row.job_id, matchConfidence: row.match_confidence };
}
function matchMailboxToJob(db, message, profile = "") {
  const text = `${message.subject ?? ""} ${message.preview ?? ""}`.toLowerCase();
  const sender = String(message.from_email ?? "").toLowerCase();
  const jobs = profile
    ? db.prepare("SELECT j.*, c.id AS company_id, c.name AS company_name, c.normalized_name FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.profile = ?").all(profile)
    : db.prepare("SELECT j.*, c.id AS company_id, c.name AS company_name, c.normalized_name FROM jobs j JOIN companies c ON c.id = j.company_id").all();
  let best = { company: null, job: null, confidence: 0 };
  for (const job of jobs) {
    let score = 0;
    const generic = new Set(["company", "group", "holdings", "services", "solutions", "systems", "international", "inc", "llc", "corp"]);
    const companyTokens = job.normalized_name.split(" ").filter((token) => token.length >= 4 && !generic.has(token));
    const allTokensMatch = companyTokens.length > 0 && companyTokens.every((token) => new RegExp(`\\b${escapeRegex(token)}\\b`, "i").test(text));
    const senderDomainMatch = Boolean(companyTokens[0] && companyTokens[0].length >= 5 && sender.includes(companyTokens[0]));
    if (allTokensMatch || senderDomainMatch) score += 0.65;
    if (job.external_id && text.includes(job.external_id.toLowerCase())) score += 0.45;
    const roleTokens = job.role_title.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 5);
    if (roleTokens.length && roleTokens.filter((token) => text.includes(token)).length >= Math.ceil(roleTokens.length / 2)) score += 0.25;
    if (score > best.confidence) best = { company: { id: job.company_id, name: job.company_name }, job, confidence: Math.min(1, score) };
  }
  return best;
}
function updateJobStatus(db, jobId, status, source, at, force = false) {
  const current = db.prepare("SELECT status_updated_at, status_source FROM jobs WHERE id = ?").get(jobId);
  if (!force && current?.status_source?.startsWith("mailbox:") && current.status_updated_at && new Date(current.status_updated_at) > new Date(at)) return false;
  db.prepare("UPDATE jobs SET status = ?, status_updated_at = ?, status_source = ? WHERE id = ?").run(status, at, source, jobId);
  appendEvent(db, `job-${jobId}`, "job", String(jobId), "job_status_updated", { status, source, at });
  return true;
}
function refreshJobStatusFromEvidence(db, jobId) {
  const mailbox = db.prepare("SELECT proposed_status, received_at, account FROM mailbox_events WHERE job_id = ? AND state = 'matched' AND proposed_status != 'unknown' ORDER BY received_at DESC, id DESC LIMIT 1").get(jobId);
  if (mailbox) return updateJobStatus(db, jobId, mailbox.proposed_status, `mailbox:${mailbox.account}`, mailbox.received_at || isoNow(), true);
  const history = db.prepare("SELECT status, occurred_at FROM outreach_history WHERE job_id = ? AND status IN ('sent', 'replied', 'rejected') ORDER BY occurred_at DESC, id DESC LIMIT 1").get(jobId);
  if (history) return updateJobStatus(db, jobId, history.status, "outreach_history", history.occurred_at || isoNow(), true);
  return false;
}
function repairCrossProfileMailboxStates(db, accounts) {
  const profileByAccount = new Map(accounts.map((account) => [account.alias, account.profile]));
  const jobs = db.prepare("SELECT id, profile, status_source FROM jobs WHERE status_source LIKE 'mailbox:%'").all();
  for (const job of jobs) {
    const account = String(job.status_source).slice("mailbox:".length);
    if (profileByAccount.get(account) && profileByAccount.get(account) !== job.profile) refreshJobStatusFromEvidence(db, job.id);
  }
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function outreachContext(db, providers, input) {
  if (!input?.company_id || !input?.job_id || !input?.contact_id || !input?.subject || !input?.body) throw httpError(400, "company_id, job_id, contact_id, subject, and body are required");
  const subject = String(input.subject).trim();
  const body = String(input.body);
  if (!subject || subject.length > 500 || /[\r\n\0]/.test(subject)) throw httpError(400, "subject must be one line and no more than 500 characters");
  if (!body.trim() || body.length > 20_000 || body.includes("\0")) throw httpError(400, "body must be no more than 20000 characters and cannot contain null bytes");
  const company = requireCompany(db, input.company_id); const job = requireJob(db, company.id, input.job_id); const contact = requireContact(db, company.id, input.contact_id);
  if (contact.suppressed_at || company.suppression_reason) throw httpError(409, "Suppressed company or contact cannot receive outreach");
  if (contact.email.endsWith("@local.invalid")) throw httpError(409, "Historical contact has no verified email address");
  const profile = providers.profiles[job.profile]; if (!profile?.account) throw httpError(409, `No sender account configured for profile ${job.profile}`);
  return { company, job, contact, account: profile.account, attachment: profile.resume || "", to: contact.email, subject, body, html: input.html === true };
}
function suppressContact(db, id, reason) { db.prepare("UPDATE contacts SET suppressed_at = ?, suppression_reason = ? WHERE id = ?").run(isoNow(), reason, id); }
function suppressCompany(db, id, reason) { db.prepare("UPDATE companies SET suppression_reason = ?, updated_at = ? WHERE id = ?").run(reason, isoNow(), id); }
function isFailure(type) { return type === "hard_bounce" || type === "invalid_email"; }
function appendEvent(db, correlation, entityType, entityId, type, payload) { db.prepare("INSERT INTO events (correlation_id, entity_type, entity_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(correlation, entityType, entityId, type, JSON.stringify(payload), isoNow()); }
function writeUsage(db, provider, operation, requests, credits, success, metadata) { db.prepare("INSERT INTO provider_usage (provider, operation, request_count, credit_count, success, occurred_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)").run(provider, operation, requests, credits, success ? 1 : 0, isoNow(), JSON.stringify(metadata)); }
function writeLog(db, level, category, message, correlation, context) { db.prepare("INSERT INTO system_logs (level, category, message, correlation_id, context_json, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(level, category, message, correlation, JSON.stringify(context), isoNow()); }
function parseLog(row) { const { context_json, ...fields } = row; return { ...fields, context: JSON.parse(context_json ?? "{}") }; }
function parseException(row) { const { evidence_json, proposed_action_json, ...fields } = row; return { ...fields, evidence: JSON.parse(evidence_json), proposedAction: JSON.parse(proposed_action_json) }; }
function parseHistory(row) { const { metadata_json, ...fields } = row; return { ...fields, metadata: JSON.parse(metadata_json ?? "{}") }; }
function parseEvent(row) { const { payload_json, ...fields } = row; return { ...fields, payload: JSON.parse(payload_json) }; }
function publicContact(c) { return { id: c.id, name: c.name, title: c.title, email: c.email, source: c.source, confidence: c.confidence, tier: c.tier, suppressed: Boolean(c.suppressed_at) }; }
function hydrateRun(db, run) {
  const { request_json, ...runFields } = run;
  return {
    ...runFields,
    request: JSON.parse(request_json),
    items: db.prepare("SELECT * FROM run_items WHERE run_id = ? ORDER BY id").all(run.id).map((item) => {
      const { plan_json, ...itemFields } = item;
      return { ...itemFields, plan: JSON.parse(plan_json) };
    }),
    events: db.prepare("SELECT * FROM events WHERE correlation_id = ? ORDER BY id").all(run.id).map(parseEvent),
  };
}
function stablePlans(items) { return JSON.stringify(items.map((item) => item.plan ?? item).map((item) => ({ state: item.state, contacts: item.contacts?.map((c) => c.email) ?? item.plan?.contacts?.map((c) => c.email) }))); }
function validateBatch(p) { if (!p?.profile || !Array.isArray(p.queue) || !p.queue.length) throw httpError(400, "profile and a non-empty queue are required"); }
function normalizeCompany(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function normalizeProfile(value) { const text = String(value ?? "").toLowerCase(); return text === "ba" || text.includes("business") ? "business_analyst" : text === "da" || text.includes("data") ? "data_analyst" : text.replace(/[^a-z0-9]+/g, "_") || "unassigned"; }
function isoNow() { return new Date().toISOString(); }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
export function fingerprint(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
