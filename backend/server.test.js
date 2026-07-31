import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createOutreachServer } from "./server.js";
import { classifyMailboxMessage, createProviders } from "./providers.js";
import { mergeConfig } from "./config.js";

let server;
let base;
before(async () => {
  server = createOutreachServer({ databasePath: ":memory:" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

test("shadow run builds a company-centric plan and replays deterministically", async () => {
  const payload = batch([job("row-1", "Acme, Inc.", "REQ-1"), job("row-2", "ACME INC", "REQ-2")]);
  const run = await jsonFetch("/api/batches", { method: "POST", body: JSON.stringify(payload) });
  assert.equal(run.mode, "shadow");
  assert.equal(run.items.length, 2);
  assert.equal(run.items[0].companyId, run.items[1].companyId);
  assert.equal(run.items[0].contacts.length, 3);

  const crm = await jsonFetch("/api/crm/companies");
  assert.equal(crm.companies.length, 1);
  assert.equal(crm.companies[0].job_count, 2);

  const replay = await jsonFetch(`/api/runs/${run.run_id}/replay`, { method: "POST" });
  assert.equal(replay.equivalent, true);
});

test("bounce replacement and four-failure warning are operational", async () => {
  let result;
  for (let index = 0; index < 4; index += 1) {
    result = await jsonFetch("/api/exceptions", { method: "POST", body: JSON.stringify({ company: "Bounce Co", type: "hard_bounce", email: `bad${index}@bounce.example` }) });
  }
  assert.equal(result.proposedAction.kind, "replace_contact");
  assert.equal(result.fourFailureWarning, true);
  assert.equal(result.consecutiveFailures, 4);
});

test("OOO redirects and positive replies propose the correct recovery", async () => {
  const redirect = await jsonFetch("/api/exceptions", { method: "POST", body: JSON.stringify({ company: "Referral Co", type: "ooo_redirect", name: "Pat", email: "pat@referral.example", redirect_email: "sam@referral.example" }) });
  assert.equal(redirect.proposedAction.kind, "draft_redirect");
  const reply = await jsonFetch("/api/exceptions", { method: "POST", body: JSON.stringify({ company: "Referral Co", type: "positive_reply", email: "sam@referral.example" }) });
  assert.equal(reply.proposedAction.kind, "suppress_company_outreach");

  const blocked = await jsonFetch("/api/batches", { method: "POST", body: JSON.stringify(batch([job("row-3", "Referral Co", "REQ-3")])) });
  assert.equal(blocked.items[0].blocked, true);
});

test("CRM records contacts and historical outreach on the company timeline", async () => {
  const run = await jsonFetch("/api/batches", { method: "POST", body: JSON.stringify(batch([job("row-history", "History Co", "REQ-H")])) });
  const companyId = run.items[0].companyId;
  const contact = await jsonFetch(`/api/crm/companies/${companyId}/contacts`, { method: "POST", body: JSON.stringify({ name: "Taylor Recruiter", title: "Senior Recruiter", email: "taylor@history.example", tier: 1, confidence: 0.96, source: "manual" }) });
  assert.equal(contact.tier, 1);
  const detailBefore = await jsonFetch(`/api/crm/companies/${companyId}`);
  const history = await jsonFetch(`/api/crm/companies/${companyId}/outreach`, { method: "POST", body: JSON.stringify({ contact_id: contact.id, job_id: detailBefore.jobs[0].id, profile: "data_analyst", status: "sent", subject: "Data Analyst (REQ-H)", occurred_at: "2026-07-01T12:00:00Z" }) });
  assert.equal(history.status, "sent");
  const detailAfter = await jsonFetch(`/api/crm/companies/${companyId}`);
  assert.equal(detailAfter.outreach.length, 1);
  assert.equal(detailAfter.outreach[0].contact_name, "Taylor Recruiter");
  assert.equal(detailAfter.contacts.find((item) => item.id === contact.id).last_contacted_at, "2026-07-01T12:00:00.000Z");
});

test("recovery cases can be completed and referred contacts are retained", async () => {
  const created = await jsonFetch("/api/exceptions", { method: "POST", body: JSON.stringify({ company: "Resolve Co", type: "ooo_redirect", name: "Original Recruiter", email: "original@resolve.example", redirect_email: "referral@resolve.example" }) });
  const resolved = await jsonFetch(`/api/exceptions/${created.id}/resolve`, { method: "POST", body: JSON.stringify({ resolution: "completed", note: "Redirect accepted" }) });
  assert.equal(resolved.state, "resolved");
  const crm = await jsonFetch("/api/crm/companies");
  const company = crm.companies.find((item) => item.name === "Resolve Co");
  assert.ok(company.contacts.some((item) => item.email === "referral@resolve.example"));
});

test("mailbox classifier distinguishes confirmations, bounces, OOO, and rejections", () => {
  assert.equal(classifyMailboxMessage({ subject: "Thank you for applying to Example" }).type, "application_received");
  assert.equal(classifyMailboxMessage({ subject: "Undeliverable: Follow-Up" }).type, "hard_bounce");
  assert.equal(classifyMailboxMessage({ subject: "Automatic reply: Follow-Up" }).type, "ooo");
  assert.equal(classifyMailboxMessage({ subject: "Application Update", preview: "Unfortunately we are moving forward with other candidates" }).type, "rejection");
  assert.equal(classifyMailboxMessage({ subject: "Thank you for applying", preview: "Unfortunately we will not move forward" }).type, "rejection");
  assert.equal(classifyMailboxMessage({ subject: "Next steps", preview: "We would like to schedule your interview and confirm your availability" }).type, "interview");
});

test("matched next-step replies remain visible and stop further company outreach", async () => {
  const fakeProviders = {
    accounts: [{ alias: "da", profile: "data_analyst" }],
    status: () => ({ mailbox: "mock" }),
    recentMailbox: async () => [{ id: "next-1", received: "2026-07-12T14:00:00Z", subject: "Next steps with Action Company", preview: "We would like to schedule an interview for Analyst REQ-NEXT. Please send your availability.", from_email: "recruiting@actioncompany.example", from_name: "Recruiting" }],
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${isolated.address().port}`;
  await fetchJson(host, "/api/batches", { method: "POST", body: JSON.stringify(batch([job("next-row", "Action Company", "REQ-NEXT")])) });
  const sync = await fetchJson(host, "/api/mailbox/sync", { method: "POST", body: JSON.stringify({ apply: true }) });
  assert.equal(sync.matched, 1);
  const attention = await fetchJson(host, "/api/mailbox/events?state=attention");
  assert.equal(attention.events[0].classification, "interview");
  assert.equal(attention.events[0].state, "matched");
  const recovery = await fetchJson(host, "/api/exceptions");
  assert.equal(recovery.exceptions[0].type, "next_steps");
  assert.equal(recovery.exceptions[0].proposedAction.kind, "candidate_follow_up_required");
  const companies = await fetchJson(host, "/api/crm/companies");
  assert.equal(companies.companies[0].suppression_reason, "company requested next steps");
  await new Promise((resolve) => isolated.close(resolve));
});

test("mailbox sync automatically updates only high-confidence job matches", async () => {
  const fakeProviders = {
    accounts: [{ alias: "da", profile: "data_analyst" }],
    status: () => ({ apollo: "mock", skrapp: "mock", mailbox: "mock" }),
    recentMailbox: async () => [
      { id: "mail-1", received: "2026-07-11T12:00:00Z", subject: "Thank you for applying to Match Company", preview: "We received your Data Analyst application REQ-MATCH" },
      { id: "mail-2", received: "2026-07-11T12:01:00Z", subject: "Application Update", preview: "Unfortunately we selected other candidates" },
      { id: "mail-3", received: "2026-07-11T12:02:00Z", subject: "Undeliverable: Data Analyst", preview: "Delivery failed to these recipient groups: person@other.example" },
    ],
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const isolatedBase = `http://127.0.0.1:${isolated.address().port}`;
  const payload = batch([job("match-row", "Match Company", "REQ-MATCH")]);
  await fetchJson(isolatedBase, "/api/batches", { method: "POST", body: JSON.stringify(payload) });
  const sync = await fetchJson(isolatedBase, "/api/mailbox/sync", { method: "POST", body: JSON.stringify({ apply: true }) });
  assert.equal(sync.matched, 1);
  assert.equal(sync.unmatched, 2);
  const crm = await fetchJson(isolatedBase, "/api/crm/companies");
  const detail = await fetchJson(isolatedBase, `/api/crm/companies/${crm.companies[0].id}`);
  assert.equal(detail.jobs[0].status, "application_received");
  await new Promise((resolve) => isolated.close(resolve));
});

test("mailbox sync continues when one configured account fails", async () => {
  const fakeProviders = {
    accounts: [{ alias: "broken", profile: "data_analyst" }, { alias: "healthy", profile: "business_analyst" }],
    status: () => ({ mailbox: "mock" }),
    recentMailbox: async (account) => {
      if (account === "broken") throw new Error("authorization expired");
      return [{ id: "healthy-1", received: "2026-07-12T12:00:00Z", subject: "General update", preview: "No action required" }];
    },
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  try {
    const host = `http://127.0.0.1:${isolated.address().port}`;
    const result = await fetchJson(host, "/api/mailbox/sync", { method: "POST", body: JSON.stringify({ apply: false }) });
    assert.equal(result.scanned, 1);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].account, "broken");
  } finally { await new Promise((resolve) => isolated.close(resolve)); }
});

test("reimporting applications does not erase a downstream mailbox status", async () => {
  const fakeProviders = {
    accounts: [{ alias: "da", profile: "data_analyst" }],
    status: () => ({ mailbox: "mock" }),
    recentMailbox: async () => [{ id: "reject-1", received: "2026-07-11T12:00:00Z", subject: "Application update from Durable Company", preview: "Unfortunately we are moving forward with other candidates for Analyst REQ-DURABLE" }],
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${isolated.address().port}`;
  const application = { source_row_id: "durable-row", company: "Durable Company", profile: "DA", role_title: "Analyst", job_id: "REQ-DURABLE", applied_at: "2026-07-10T12:00:00Z" };
  await fetchJson(host, "/api/import/applications", { method: "POST", body: JSON.stringify({ source: "qa", applications: [application] }) });
  await fetchJson(host, "/api/mailbox/sync", { method: "POST", body: JSON.stringify({ apply: true }) });
  await fetchJson(host, "/api/import/applications", { method: "POST", body: JSON.stringify({ source: "qa", applications: [application] }) });
  const companies = await fetchJson(host, "/api/crm/companies");
  const detail = await fetchJson(host, `/api/crm/companies/${companies.companies[0].id}`);
  assert.equal(detail.jobs[0].status, "rejected");
  await new Promise((resolve) => isolated.close(resolve));
});

test("email-provider drafts route by profile while live sends remain locked", async () => {
  const fakeProviders = {
    accounts: [], profiles: { data_analyst: { account: "da", resume: "resume.pdf" } }, liveSendEnabled: false,
    status: () => ({ mailbox: "mock" }),
    createDraft: async (input) => ({ id: "draft-1", web_link: "https://example.test/draft", routed_account: input.account }),
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${isolated.address().port}`;
  const run = await fetchJson(host, "/api/batches", { method: "POST", body: JSON.stringify(batch([job("draft-row", "Draft Co", "REQ-D")])) });
  const contact = await fetchJson(host, `/api/crm/companies/${run.items[0].companyId}/contacts`, { method: "POST", body: JSON.stringify({ name: "Recruiter", email: "recruiter@draft.example", tier: 1 }) });
  const draft = await fetchJson(host, "/api/outreach/drafts", { method: "POST", body: JSON.stringify({ company_id: run.items[0].companyId, job_id: run.items[0].jobId, contact_id: contact.id, subject: "QA draft", body: "QA body" }) });
  assert.equal(draft.account, "da");
  assert.equal(draft.draft_id, "draft-1");
  const sendResponse = await fetch(`${host}/api/outreach/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approval: "SEND_APPROVED" }) });
  assert.equal(sendResponse.status, 403);
  await new Promise((resolve) => isolated.close(resolve));
});

test("public sample mode is an absolute provider send lock", async () => {
  const providers = createProviders({ publicSampleMode: true, liveSendEnabled: true, profiles: {}, accounts: [], outlookHelper: "", legacyWorkspace: "", python: "python" });
  await assert.rejects(() => providers.send({}), /disabled in public sample mode/);
});

test("public sample mode never opens a configured private database", async () => {
  const directory = mkdtempSync(join(tmpdir(), "outreach-sample-isolation-"));
  const databasePath = join(directory, "private.sqlite");
  const privateProviders = createProviders({ publicSampleMode: false, liveSendEnabled: false, profiles: {}, accounts: [], outlookHelper: "", legacyWorkspace: "", python: "python" });
  const sampleProviders = createProviders({ publicSampleMode: true, liveSendEnabled: false, profiles: {}, accounts: [], outlookHelper: "", legacyWorkspace: "", python: "python" });
  let privateServer;
  let sampleServer;
  try {
    privateServer = createOutreachServer({ databasePath, providers: privateProviders });
    await new Promise((resolve) => privateServer.listen(0, "127.0.0.1", resolve));
    const privateHost = `http://127.0.0.1:${privateServer.address().port}`;
    await fetchJson(privateHost, "/api/import/applications", { method: "POST", body: JSON.stringify({ source: "private", applications: [{ source_row_id: "private-row", company: "Private Company", profile: "private_profile", role_title: "Private Role" }] }) });
    await new Promise((resolve) => privateServer.close(resolve));
    privateServer = null;

    sampleServer = createOutreachServer({ databasePath, providers: sampleProviders });
    await new Promise((resolve) => sampleServer.listen(0, "127.0.0.1", resolve));
    const sampleHost = `http://127.0.0.1:${sampleServer.address().port}`;
    const crm = await fetchJson(sampleHost, "/api/crm/companies");
    assert.deepEqual(crm.companies, []);
  } finally {
    if (privateServer?.listening) await new Promise((resolve) => privateServer.close(resolve));
    if (sampleServer?.listening) await new Promise((resolve) => sampleServer.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});

test("environment safety flags override null local config values", () => {
  const config = mergeConfig(
    { publicSampleMode: false, liveSendEnabled: false },
    { publicSampleMode: null, liveSendEnabled: null },
    { OUTREACH_PUBLIC_SAMPLE_MODE: "1", OUTREACH_LIVE_SEND: "0" },
  );
  assert.equal(config.publicSampleMode, true);
  assert.equal(config.liveSendEnabled, false);
});

test("integration preferences are provider-neutral, atomic, and honest about missing adapters", () => {
  const directory = mkdtempSync(join(tmpdir(), "outreach-integrations-"));
  const configPath = join(directory, "local-config.json");
  try {
    const providers = createProviders({ publicSampleMode: false, liveSendEnabled: false, profiles: {}, accounts: [], outlookHelper: "", legacyWorkspace: "", python: "python", configPath });
    const result = providers.configure({
      primaryEnrichment: { providerId: "hunter", label: "Hunter", enabled: true, credentialEnv: "HUNTER_API_KEY" },
      fallbackEnrichment: { providerId: "none", label: "No provider", enabled: false, credentialEnv: "" },
      mailbox: { providerId: "gmail_api", label: "Gmail", enabled: true, credentialEnv: "" },
    });
    assert.equal(result.providers.find((item) => item.role === "primary_enrichment").status, "adapter-required");
    assert.equal(result.providers.find((item) => item.role === "fallback_enrichment").status, "disabled");
    assert.equal(result.providers.find((item) => item.role === "mailbox").status, "adapter-required");
    assert.equal(JSON.parse(readFileSync(configPath, "utf8")).integrations.mailbox.providerId, "gmail_api");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("a configured normalized helper can back a custom provider label", () => {
  const providers = createProviders({
    publicSampleMode: false,
    liveSendEnabled: false,
    profiles: {},
    accounts: [],
    mailboxHelper: "",
    enrichmentHelper: fileURLToPath(import.meta.url),
    enrichmentSetupHelper: "",
    writingHelper: "",
    legacyWorkspace: "",
    python: "python",
    integrations: {
      primaryEnrichment: { providerId: "custom_enrichment", label: "Private Directory", enabled: true, credentialEnv: "PRIVATE_DIRECTORY_KEY" },
      fallbackEnrichment: { providerId: "none", label: "No provider", enabled: false, credentialEnv: "" },
      mailbox: { providerId: "none", label: "Drafts only", enabled: false, credentialEnv: "" },
    },
  });
  const primary = providers.describe().find((item) => item.role === "primary_enrichment");
  assert.equal(primary.label, "Private Directory");
  assert.equal(primary.status, "configured");
});

test("new enrichment helpers receive provider-neutral paid lookup arguments", async () => {
  const directory = mkdtempSync(join(tmpdir(), "outreach-helper-"));
  const helper = join(directory, "enrichment-helper.mjs");
  writeFileSync(helper, `
    import { writeFileSync } from "node:fs";
    const args = process.argv.slice(2);
    const output = args[args.indexOf("--output") + 1];
    writeFileSync(output, "full_name,email,title,email_source,email_status,title_tier\\nSynthetic Recruiter,recruiter@synthetic.invalid,Talent Partner,custom_directory,verified,1\\n");
    console.log(JSON.stringify({ args }));
  `);
  try {
    const providers = createProviders({
      publicSampleMode: false,
      liveSendEnabled: false,
      profiles: {},
      accounts: [],
      enrichmentHelper: helper,
      enrichmentSetupHelper: "",
      mailboxHelper: "",
      writingHelper: "",
      legacyWorkspace: "",
      python: "python",
      integrations: {
        primaryEnrichment: { providerId: "custom_directory", label: "Custom Directory", enabled: true, credentialEnv: "CONTACT_PROVIDER_API_KEY" },
        fallbackEnrichment: { providerId: "none", label: "No provider", enabled: false, credentialEnv: "" },
        mailbox: { providerId: "none", label: "Drafts only", enabled: false, credentialEnv: "" },
      },
    });
    const result = await providers.enrich({ company: "Synthetic Company", maxContacts: 2, spendCredits: true });
    assert.equal(result.contacts[0].email, "recruiter@synthetic.invalid");
    assert.deepEqual(result.summary.args.slice(-3), ["--provider", "custom_directory", "--allow-paid-lookups"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("setup validation requires resume files to exist", async () => {
  const fakeProviders = {
    profiles: { data_analyst: { account: "da", resume: "Z:\\definitely-missing\\resume.pdf" } },
    liveSendEnabled: false,
    publicSampleMode: false,
    status: () => ({ apollo: "mock", skrapp: "mock", mailbox: "mock" }),
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${isolated.address().port}`;
  const setup = await fetchJson(host, "/api/setup/status");
  assert.equal(setup.profiles[0].resumeConfigured, false);
  await new Promise((resolve) => isolated.close(resolve));
});

test("synthetic end-to-end pipeline covers import, enrichment, draft, mailbox, recovery, dashboard, and incident export", async () => {
  const fakeProviders = {
    accounts: [{ alias: "da", profile: "data_analyst" }], profiles: { data_analyst: { account: "da" } }, liveSendEnabled: false, publicSampleMode: false,
    status: () => ({ apollo: "mock", skrapp: "mock", mailbox: "mock" }),
    integrations: () => ({ primaryEnrichment: { providerId: "apollo" }, mailbox: { providerId: "synthetic_mailbox" } }),
    enrich: async () => ({ paidLookups: false, summary: {}, contacts: [{ full_name: "Synthetic Recruiter", email: "recruiter@synthetic.example", title: "Talent Acquisition", email_source: "apollo", email_status: "verified", title_tier: "1", draft_ready: "yes" }] }),
    createDraft: async () => ({ id: "synthetic-draft" }),
    recentMailbox: async () => [{ id: "synthetic-confirmation", received: "2026-07-11T18:00:00Z", subject: "Application received at Synthetic Company", preview: "Your Analyst application SYN-1 is under review", from_email: "jobs@synthetic.example" }, { id: "synthetic-bounce", received: "2026-07-11T18:01:00Z", subject: "Undeliverable: Analyst", preview: "Delivery failed to recruiter@synthetic.example", from_email: "postmaster@synthetic.example" }],
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders }); await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve)); const host = `http://127.0.0.1:${isolated.address().port}`;
  const imported = await fetchJson(host, "/api/import/applications", { method: "POST", body: JSON.stringify({ source: "synthetic", applications: [{ source_row_id: "syn-row", company: "Synthetic Company", company_domain: "synthetic.example", profile: "DA", role_title: "Analyst", job_id: "SYN-1" }] }) }); assert.equal(imported.imported, 1);
  const companies = await fetchJson(host, "/api/crm/companies"); const company = companies.companies[0]; const detail = await fetchJson(host, `/api/crm/companies/${company.id}`);
  const enriched = await fetchJson(host, `/api/crm/companies/${company.id}/enrich`, { method: "POST", body: JSON.stringify({ job_id: detail.jobs[0].id, spend_credits: false }) }); assert.equal(enriched.savedContacts, 1);
  const updated = await fetchJson(host, `/api/crm/companies/${company.id}`); const contact = updated.contacts.find((item) => item.email === "recruiter@synthetic.example");
  const draft = await fetchJson(host, "/api/outreach/drafts", { method: "POST", body: JSON.stringify({ company_id: company.id, job_id: detail.jobs[0].id, contact_id: contact.id, subject: "Synthetic draft", body: "Synthetic body" }) }); assert.equal(draft.draft_id, "synthetic-draft");
  const sync = await fetchJson(host, "/api/mailbox/sync", { method: "POST", body: JSON.stringify({ apply: true }) }); assert.equal(sync.matched, 2);
  const finalDetail = await fetchJson(host, `/api/crm/companies/${company.id}`); assert.equal(finalDetail.jobs[0].status, "bounced");
  const recovery = await fetchJson(host, "/api/exceptions"); assert.equal(recovery.exceptions.some((item) => item.type === "hard_bounce"), true);
  const dashboard = await fetchJson(host, "/api/dashboard"); assert.equal(dashboard.usage.some((item) => item.provider === "apollo"), true);
  const incident = await fetchJson(host, "/api/incidents/report"); assert.equal(Array.isArray(incident.openExceptions), true);
  await new Promise((resolve) => isolated.close(resolve));
});

test("writing adapter output is matched by draft ID and persisted for review", async () => {
  const fakeProviders = {
    profiles: {},
    accounts: [],
    liveSendEnabled: false,
    publicSampleMode: false,
    status: () => ({ writing: "mock" }),
    generateMessages: async (input) => input.drafts.map((draft) => ({ draft_id: draft.id, subject: `${draft.roleTitle} follow-up`, body: `Hi ${draft.recipientName}, thank you for reviewing my application.` })),
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${isolated.address().port}`;
  try {
    const input = {
      brief: "Use only supplied facts.",
      maximum_words: 80,
      drafts: [{
        id: "source-1::1",
        jobRowId: "source-1",
        profile: "data_analyst",
        company: "Writing Company",
        roleTitle: "Data Analyst",
        recipientName: "Alex",
        recipientEmail: "alex@writing.example",
        recipientTitle: "Recruiter",
        mode: "in_app_llm",
        status: "needs_writing",
        subject: "",
        body: "",
        promptOverride: "",
        updatedAt: "2026-07-01T12:00:00Z",
      }],
    };
    const generated = await fetchJson(host, "/api/writing/generate", { method: "POST", body: JSON.stringify(input) });
    assert.equal(generated.messages[0].draft_id, "source-1::1");
    assert.equal(generated.messages[0].over_limit, false);
    const stored = await fetchJson(host, "/api/writing/drafts");
    assert.equal(stored.drafts[0].recipient_email, "alex@writing.example");
    assert.equal(stored.drafts[0].status, "ready");
  } finally { await new Promise((resolve) => isolated.close(resolve)); }
});

test("writing adapter must return one unique result for every requested draft", async () => {
  const fakeProviders = {
    profiles: {}, accounts: [], liveSendEnabled: false, publicSampleMode: false,
    status: () => ({ writing: "mock" }),
    generateMessages: async () => [
      { draft_id: "source-1::1", subject: "First", body: "First body" },
      { draft_id: "source-1::1", subject: "Duplicate", body: "Duplicate body" },
    ],
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${isolated.address().port}`;
  const draft = (id) => ({ id, jobRowId: id.split("::")[0], profile: "data_analyst", company: "Writing Company", roleTitle: "Data Analyst", recipientName: "Alex", recipientEmail: "alex@writing.example", recipientTitle: "Recruiter", mode: "in_app_llm", status: "needs_writing", subject: "", body: "", promptOverride: "", updatedAt: "2026-07-01T12:00:00Z" });
  try {
    const response = await fetch(`${host}/api/writing/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: "Use only supplied facts.", maximum_words: 80, drafts: [draft("source-1::1"), draft("source-2::1")] }) });
    const value = await response.json();
    assert.equal(response.status, 502);
    assert.match(value.error, /duplicate draft ID/);
  } finally { await new Promise((resolve) => isolated.close(resolve)); }
});

test("AI connection check route returns the provider's no-inference status", async () => {
  let received = null;
  const fakeProviders = {
    profiles: {},
    accounts: [],
    liveSendEnabled: false,
    publicSampleMode: false,
    status: () => ({ writing: "bundled-plan-cli" }),
    checkAi: async (input) => {
      received = input;
      return { mode: input.mode, label: "Fake plan CLI", status: "ready", installed: true, authenticated: true, detail: "Saved account login verified.", nextCommand: "", version: "1.0.0", availableModels: [] };
    },
  };
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: fakeProviders });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${isolated.address().port}`;
  try {
    const checked = await fetchJson(host, "/api/writing/check", { method: "POST", body: JSON.stringify({ controlMode: "in_app", mode: "codex_cli", model: "" }) });
    assert.equal(checked.status, "ready");
    assert.equal(checked.authenticated, true);
    assert.equal(received.mode, "codex_cli");
  } finally { await new Promise((resolve) => isolated.close(resolve)); }
});

test("localhost HTTP boundary blocks foreign browser origins and oversized JSON", async () => {
  const isolated = createOutreachServer({ databasePath: ":memory:", providers: null, maximumBodyBytes: 1024 });
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${isolated.address().port}`;
  try {
    const forbidden = await fetch(`${host}/api/health`, { headers: { Origin: "https://untrusted.example" } });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.headers.get("access-control-allow-origin"), null);

    const allowed = await fetch(`${host}/api/health`, { headers: { Origin: "http://127.0.0.1:5177" } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://127.0.0.1:5177");

    const oversized = await fetch(`${host}/api/import/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applications: [], padding: "x".repeat(2000) }),
    });
    assert.equal(oversized.status, 413);
  } finally { await new Promise((resolve) => isolated.close(resolve)); }
});

function batch(queue) { return { profile: "data_analyst", scheduled_at: new Date().toISOString(), spacing_seconds: 30, contact_target: 3, instructions: {}, queue }; }
function job(source, company, id) { return { source_row_id: source, company, role_title: "Analyst", job_id: id, job_url: `https://example.test/${id}`, profile: "data_analyst", contact_quality: "clean" }; }
async function jsonFetch(path, options = {}) { const response = await fetch(`${base}${path}`, { headers: { "Content-Type": "application/json" }, ...options }); const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value; }
async function fetchJson(host, path, options = {}) { const response = await fetch(`${host}${path}`, { headers: { "Content-Type": "application/json" }, ...options }); const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value; }
