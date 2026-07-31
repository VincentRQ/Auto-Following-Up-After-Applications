import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadConfig(path, env = process.env) {
  const requestedPath = path ?? env.OUTREACH_CONFIG ?? "data/local-config.json";
  const publicSampleMode = env.OUTREACH_PUBLIC_SAMPLE_MODE === "1";
  const defaults = {
    python: env.OUTREACH_PYTHON ?? "python",
    legacyWorkspace: env.OUTREACH_LEGACY_WORKSPACE ?? "",
    enrichmentHelper: env.OUTREACH_ENRICHMENT_HELPER ?? "",
    enrichmentSetupHelper: env.OUTREACH_ENRICHMENT_SETUP_HELPER ?? "",
    mailboxHelper: env.OUTREACH_MAILBOX_HELPER ?? env.OUTREACH_OUTLOOK_HELPER ?? "",
    outlookHelper: env.OUTREACH_OUTLOOK_HELPER ?? "",
    writingHelper: env.OUTREACH_WRITING_HELPER ?? "",
    accounts: publicSampleMode ? [] : [
      { alias: "ba", profile: "business_analyst" },
      { alias: "da", profile: "data_analyst" },
    ],
    profiles: {},
    liveSendEnabled: !publicSampleMode && env.OUTREACH_LIVE_SEND === "1",
    publicSampleMode,
    integrations: defaultIntegrations(),
  };
  const configPath = resolve(requestedPath);
  if (publicSampleMode) {
    return {
      ...defaults,
      legacyWorkspace: "",
      enrichmentHelper: "",
      enrichmentSetupHelper: "",
      mailboxHelper: "",
      outlookHelper: "",
      writingHelper: "",
      configPath,
    };
  }
  if (!existsSync(requestedPath)) return { ...defaults, configPath };
  try {
    const local = JSON.parse(readFileSync(requestedPath, "utf8"));
    return mergeConfig(defaults, local, env, configPath);
  } catch {
    return { ...defaults, configPath, configError: "Local provider configuration is not valid JSON. Defaults were loaded without provider access." };
  }
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
