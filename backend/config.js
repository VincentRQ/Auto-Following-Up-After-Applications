import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadConfig(path = process.env.OUTREACH_CONFIG ?? "data/local-config.json") {
  const defaults = {
    python: process.env.OUTREACH_PYTHON ?? "python",
    legacyWorkspace: process.env.OUTREACH_LEGACY_WORKSPACE ?? "",
    enrichmentHelper: process.env.OUTREACH_ENRICHMENT_HELPER ?? "",
    enrichmentSetupHelper: process.env.OUTREACH_ENRICHMENT_SETUP_HELPER ?? "",
    mailboxHelper: process.env.OUTREACH_MAILBOX_HELPER ?? process.env.OUTREACH_OUTLOOK_HELPER ?? "",
    outlookHelper: process.env.OUTREACH_OUTLOOK_HELPER ?? "",
    writingHelper: process.env.OUTREACH_WRITING_HELPER ?? "",
    accounts: [
      { alias: "ba", profile: "business_analyst" },
      { alias: "da", profile: "data_analyst" },
    ],
    profiles: {},
    liveSendEnabled: process.env.OUTREACH_LIVE_SEND === "1",
    publicSampleMode: process.env.OUTREACH_PUBLIC_SAMPLE_MODE === "1",
    integrations: defaultIntegrations(),
  };
  if (!existsSync(path)) return { ...defaults, configPath: resolve(path) };
  const local = JSON.parse(readFileSync(path, "utf8"));
  return mergeConfig(defaults, local, process.env, resolve(path));
}

export function mergeConfig(defaults, local, env = {}, configPath = "") {
  const merged = { ...defaults, ...local, integrations: mergeIntegrations(defaults.integrations, local.integrations), configPath };
  if (env.OUTREACH_PYTHON) merged.python = env.OUTREACH_PYTHON;
  if (env.OUTREACH_LEGACY_WORKSPACE) merged.legacyWorkspace = env.OUTREACH_LEGACY_WORKSPACE;
  if (env.OUTREACH_ENRICHMENT_HELPER) merged.enrichmentHelper = env.OUTREACH_ENRICHMENT_HELPER;
  if (env.OUTREACH_ENRICHMENT_SETUP_HELPER) merged.enrichmentSetupHelper = env.OUTREACH_ENRICHMENT_SETUP_HELPER;
  if (env.OUTREACH_MAILBOX_HELPER) merged.mailboxHelper = env.OUTREACH_MAILBOX_HELPER;
  if (env.OUTREACH_OUTLOOK_HELPER) merged.outlookHelper = env.OUTREACH_OUTLOOK_HELPER;
  if (env.OUTREACH_WRITING_HELPER) merged.writingHelper = env.OUTREACH_WRITING_HELPER;
  if (env.OUTREACH_LIVE_SEND !== undefined) merged.liveSendEnabled = env.OUTREACH_LIVE_SEND === "1";
  if (env.OUTREACH_PUBLIC_SAMPLE_MODE !== undefined) merged.publicSampleMode = env.OUTREACH_PUBLIC_SAMPLE_MODE === "1";
  return merged;
}

function defaultIntegrations() {
  return {
    primaryEnrichment: { providerId: "none", label: "No provider", enabled: false, credentialEnv: "" },
    fallbackEnrichment: { providerId: "none", label: "No provider", enabled: false, credentialEnv: "" },
    mailbox: { providerId: "none", label: "Drafts only / no mailbox", enabled: false, credentialEnv: "" },
  };
}

function mergeIntegrations(defaults = defaultIntegrations(), local = {}) {
  return {
    primaryEnrichment: { ...defaults.primaryEnrichment, ...(local?.primaryEnrichment ?? {}) },
    fallbackEnrichment: { ...defaults.fallbackEnrichment, ...(local?.fallbackEnrichment ?? {}) },
    mailbox: { ...defaults.mailbox, ...(local?.mailbox ?? {}) },
  };
}
