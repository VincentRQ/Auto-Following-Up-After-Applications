import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { checkPlanAiConnection, generatePlanAiMessages, isPlanCliMode, normalizeAiConnection } from "./ai-cli.js";

const execFileAsync = promisify(execFile);

export function createProviders(config) {
  const enrichmentScript = config.enrichmentHelper || (config.legacyWorkspace ? join(config.legacyWorkspace, "crm", "enrichment", "enrich_contacts.py") : "");
  const setupScript = config.enrichmentSetupHelper || (config.legacyWorkspace ? join(config.legacyWorkspace, "crm", "enrichment", "check_enrichment_setup.py") : "");
  const mailboxScript = config.mailboxHelper || config.outlookHelper || "";
  const writingScript = config.writingHelper || "";
  let integrations = normalizeIntegrations(config.integrations);
  const providerApi = {
    publicSampleMode: config.publicSampleMode === true,
    status() {
      const descriptions = providerApi.describe();
      return {
        enrichment: descriptions.find((item) => item.role === "primary_enrichment")?.status ?? "missing",
        fallback: descriptions.find((item) => item.role === "fallback_enrichment")?.status ?? "disabled",
        mailbox: descriptions.find((item) => item.role === "mailbox")?.status ?? "missing",
        writing: writingScript && existsSync(writingScript) ? "configured-helper" : "bundled-plan-cli",
        writingCustom: writingScript && existsSync(writingScript) ? "configured" : "adapter-required",
      };
    },
    describe() {
      return [
        describeSelection("primary_enrichment", integrations.primaryEnrichment, existsSync(enrichmentScript)),
        describeSelection("fallback_enrichment", integrations.fallbackEnrichment, existsSync(enrichmentScript)),
        describeSelection("mailbox", integrations.mailbox, existsSync(mailboxScript)),
      ];
    },
    catalog() { return providerCatalog; },
    integrations() { return { version: 1, ...integrations }; },
    configure(next) {
      integrations = normalizeIntegrations(next);
      persistIntegrations(config.configPath, integrations);
      return { integrations: providerApi.integrations(), providers: providerApi.describe() };
    },
    async check() {
      const checks = await Promise.allSettled([
        existsSync(setupScript) ? runHelperJson(config.python, setupScript, [], config.legacyWorkspace) : Promise.resolve(null),
        integrations.mailbox.enabled && existsSync(mailboxScript) ? runHelperJson(config.python, mailboxScript, ["accounts"], config.legacyWorkspace || undefined) : Promise.resolve([]),
      ]);
      return {
        enrichment: settledValue(checks[0]),
        accounts: settledValue(checks[1], []),
        errors: checks.map((item, index) => item.status === "rejected" ? { area: index === 0 ? "enrichment" : "mailbox", message: item.reason?.message ?? String(item.reason) } : null).filter(Boolean),
        status: providerApi.status(),
        providers: providerApi.describe(),
      };
    },
    async checkAi(input) {
      const connection = normalizeAiConnection(input);
      if (isPlanCliMode(connection.mode)) return checkPlanAiConnection(connection);
      if (writingScript && existsSync(writingScript)) {
        return { mode: connection.mode, label: "Private writing adapter", status: "ready", installed: true, authenticated: false, detail: "A private writing adapter is configured. Its provider authentication remains in that helper.", nextCommand: "", version: "", availableModels: [] };
      }
      return { mode: connection.mode, label: connection.mode, status: "adapter_required", installed: false, authenticated: false, detail: "This connection requires OUTREACH_WRITING_HELPER. No provider call was made.", nextCommand: "", version: "", availableModels: [] };
    },
    async enrich(input) {
      if (config.publicSampleMode) throw providerError("Provider calls are disabled in public sample mode");
      requireEnabled(integrations.primaryEnrichment, "enrichment");
      if (!existsSync(enrichmentScript)) throw providerError(`${integrations.primaryEnrichment.label} enrichment helper is not configured`);
      const workDir = resolve("data/provider-work", randomUUID());
      mkdirSync(workDir, { recursive: true });
      const inputPath = join(workDir, "application.csv");
      const outputPath = join(workDir, "contacts.csv");
      writeFileSync(inputPath, toCsv([{
        company: input.company,
        company_domain: input.domain ?? "",
        profile: input.profile ?? "",
        role_title: input.roleTitle ?? "",
        job_id: input.jobId ?? "",
        job_url: input.jobUrl ?? "",
        application_status: "applied",
        source: "outreach-console",
        max_contacts: String(input.maxContacts ?? 3),
      }]), "utf8");
      const args = ["--input", inputPath, "--output", outputPath, "--max-contacts", String(input.maxContacts ?? 3)];
      const usesLegacyHelper = !config.enrichmentHelper && Boolean(config.legacyWorkspace);
      if (usesLegacyHelper) {
        if (input.spendCredits) args.push("--unlock-apollo-emails", "--find-emails");
      } else {
        args.push("--provider", integrations.primaryEnrichment.providerId);
        if (input.spendCredits) args.push("--allow-paid-lookups");
      }
      try {
        const summary = await runHelperJson(config.python, enrichmentScript, args, config.legacyWorkspace);
        const contacts = parseCsv(readFileSync(outputPath, "utf8"));
        return { summary, contacts, paidLookups: Boolean(input.spendCredits) };
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    },
    async recentMailbox(account, top = 50) {
      if (config.publicSampleMode) throw providerError("Mailbox access is disabled in public sample mode");
      requireEnabled(integrations.mailbox, "mailbox");
      if (!existsSync(mailboxScript)) throw providerError(`${integrations.mailbox.label} mailbox helper is not configured`);
      return runHelperJson(config.python, mailboxScript, ["recent", "--account", account, "--top", String(Math.min(200, top))], config.legacyWorkspace || undefined);
    },
    async createDraft(input) {
      if (config.publicSampleMode) throw providerError("Mailbox writes are disabled in public sample mode");
      requireEnabled(integrations.mailbox, "mailbox");
      if (!existsSync(mailboxScript)) throw providerError(`${integrations.mailbox.label} mailbox helper is not configured`);
      const args = ["draft", "--account", input.account, "--to", input.to, "--subject", input.subject, "--body", input.body];
      if (input.attachment) args.push("--attachment", input.attachment);
      if (input.html) args.push("--html");
      return runHelperJson(config.python, mailboxScript, args, config.legacyWorkspace || undefined);
    },
    async send(input) {
      if (config.publicSampleMode) throw providerError("Mailbox sends are disabled in public sample mode");
      if (!config.liveSendEnabled) throw providerError("Live sending is disabled. Set OUTREACH_LIVE_SEND=1 only for an approved send session.");
      requireEnabled(integrations.mailbox, "mailbox");
      if (!existsSync(mailboxScript)) throw providerError(`${integrations.mailbox.label} mailbox helper is not configured`);
      const args = ["send", "--account", input.account, "--to", input.to, "--subject", input.subject, "--body", input.body];
      if (input.attachment) args.push("--attachment", input.attachment);
      if (input.html) args.push("--html");
      return runHelperJson(config.python, mailboxScript, args, config.legacyWorkspace || undefined);
    },
    async generateMessages(input) {
      if (config.publicSampleMode) throw providerError("AI provider calls are disabled in public sample mode");
      const connection = normalizeAiConnection(input.ai_connection);
      if (isPlanCliMode(connection.mode)) return generatePlanAiMessages(connection, input);
      if (!existsSync(writingScript)) throw providerError("Writing helper is not configured for this AI connection");
      const workDir = resolve("data/provider-work", randomUUID());
      mkdirSync(workDir, { recursive: true });
      const inputPath = join(workDir, "writing-request.json");
      writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
      try {
        const result = await runHelperJson(config.python, writingScript, ["--input", inputPath], config.legacyWorkspace || undefined);
        return Array.isArray(result) ? result : result.messages;
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    },
    accounts: config.accounts,
    profiles: config.profiles ?? {},
    liveSendEnabled: config.liveSendEnabled === true,
  };
  return providerApi;
}

const providerCatalog = {
  enrichment: [
    { id: "apollo", label: "Apollo", adapter: "external" }, { id: "skrapp", label: "Skrapp", adapter: "external" },
    { id: "hunter", label: "Hunter", adapter: "external" }, { id: "prospeo", label: "Prospeo", adapter: "external" },
    { id: "snov", label: "Snov.io", adapter: "external" }, { id: "custom_enrichment", label: "Custom enrichment service", adapter: "external" },
    { id: "none", label: "No provider", adapter: "disabled" },
  ],
  mailbox: [
    { id: "outlook_graph", label: "Microsoft Outlook", adapter: "external" }, { id: "gmail_api", label: "Gmail", adapter: "external" },
    { id: "imap_smtp", label: "Yahoo or IMAP/SMTP mail", adapter: "external" }, { id: "custom_mailbox", label: "Custom email service", adapter: "external" },
    { id: "none", label: "Drafts only / no mailbox", adapter: "disabled" },
  ],
};

function normalizeIntegrations(value = {}) {
  return {
    primaryEnrichment: normalizeSelection(value.primaryEnrichment, { providerId: "none", label: "No provider", enabled: false, credentialEnv: "" }),
    fallbackEnrichment: normalizeSelection(value.fallbackEnrichment, { providerId: "none", label: "No provider", enabled: false, credentialEnv: "" }),
    mailbox: normalizeSelection(value.mailbox, { providerId: "none", label: "Drafts only / no mailbox", enabled: false, credentialEnv: "" }),
  };
}
function normalizeSelection(value, fallback) {
  const merged = { ...fallback, ...(value ?? {}) };
  return { providerId: String(merged.providerId || fallback.providerId), label: String(merged.label || fallback.label), enabled: merged.enabled !== false && merged.providerId !== "none", credentialEnv: String(merged.credentialEnv || "") };
}
function describeSelection(role, selection, helperReady) {
  if (!selection.enabled || selection.providerId === "none") return { role, providerId: selection.providerId, label: selection.label, status: "disabled", detail: "This workflow step is disabled." };
  return { role, providerId: selection.providerId, label: selection.label, status: helperReady ? "configured" : "adapter-required", detail: helperReady ? "Configured local adapter is available." : "Select a compatible local adapter path, then test it before enabling provider actions." };
}
function requireEnabled(selection, role) {
  if (!selection.enabled || selection.providerId === "none") throw providerError(`${selection.label} is disabled for the ${role} role`);
}
function settledValue(result, fallback = null) { return result.status === "fulfilled" ? result.value : fallback; }
function persistIntegrations(configPath, integrations) {
  if (!configPath) return;
  const resolved = resolve(configPath); mkdirSync(dirname(resolved), { recursive: true });
  const current = existsSync(resolved) ? JSON.parse(readFileSync(resolved, "utf8")) : {};
  const temporary = `${resolved}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ ...current, integrations }, null, 2)}\n`, "utf8"); renameSync(temporary, resolved);
}

export function classifyMailboxMessage(message) {
  const subject = String(message.subject ?? "");
  const preview = String(message.preview ?? "");
  const text = `${subject} ${preview}`.toLowerCase();
  if (/undeliverable|delivery has failed|couldn't be delivered/.test(text)) return { type: "hard_bounce", status: "bounced", confidence: 0.99 };
  if (/automatic reply|out of (the )?office|away from the office/.test(text)) return { type: "ooo", status: "waiting", confidence: 0.95 };
  if (/unfortunately|not selected|not (?:to )?(?:be )?(?:moving|move|proceeding)|not proceed(?:ing)?(?: forward)?|not moving forward|decided not to proceed|other candidates|application update|feedback on your recent/.test(text)) return { type: "rejection", status: "rejected", confidence: 0.9 };
  if (/thank(s| you) for applying|application.{0,100}received|received your application|application confirmation|under review/.test(text)) return { type: "application_received", status: "application_received", confidence: 0.92 };
  if (/interview|phone screen|screening call|schedule (?:a |your )?(?:call|conversation|interview)|next steps?|your availability|invite you to|move forward with you|complete (?:an|the) assessment/.test(text) && !/job alert|courses|resume is ready/.test(text)) return { type: "interview", status: "interview", confidence: 0.9 };
  if (/^re:.*follow-up/i.test(subject)) return { type: "human_reply", status: "replied", confidence: 0.75 };
  return { type: "other", status: "unknown", confidence: 0.2 };
}

async function runJson(command, args, cwd) {
  try {
    const { stdout } = await execFileAsync(command, args, { cwd, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, windowsHide: true });
    return JSON.parse(stdout);
  } catch (error) {
    throw providerError(redactProviderError(error.stderr?.trim() || error.stdout?.trim() || error.message));
  }
}
function runHelperJson(python, script, args, cwd) {
  const extension = extname(script).toLowerCase();
  if ([".js", ".mjs", ".cjs"].includes(extension)) return runJson(process.execPath, [script, ...args], cwd);
  if (extension === ".py") return runJson(python, [script, ...args], cwd);
  return runJson(script, args, cwd);
}
function providerError(message) { const error = new Error(message); error.status = 502; return error; }
function redactProviderError(value) {
  return String(value ?? "Provider helper failed")
    .replace(/bearer\s+[a-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/((?:api[_-]?key|authorization|token|secret|password)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .slice(0, 4000);
}
function csv(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function toCsv(rows) { const fields = Object.keys(rows[0]); return `${fields.join(",")}\n${rows.map((row) => fields.map((field) => csv(row[field])).join(",")).join("\n")}\n`; }
function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) { const char = text[index]; if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; } else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; } else cell += char; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers = [], ...data] = rows; return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
