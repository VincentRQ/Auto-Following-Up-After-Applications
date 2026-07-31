import type { IntegrationSelection, IntegrationSettings } from "../types";

export interface IntegrationOption {
  id: string;
  label: string;
  credentialEnv: string;
  adapter: "built_in" | "external" | "disabled";
  setup: string;
  docs: string;
  mcpUrl?: string;
}

export const enrichmentOptions: IntegrationOption[] = [
  { id: "apollo", label: "Apollo", credentialEnv: "APOLLO_API_KEY", adapter: "external", setup: "Connect a compatible local enrichment adapter, then add the API key to the backend environment.", docs: "https://docs.apollo.io/" },
  { id: "skrapp", label: "Skrapp", credentialEnv: "SKRAPP_API_KEY", adapter: "external", setup: "Connect a compatible local enrichment adapter, then add the API key to the backend environment.", docs: "https://skrapp.io/api" },
  { id: "hunter", label: "Hunter", credentialEnv: "HUNTER_API_KEY", adapter: "external", setup: "Use Hunter's official MCP from an external AI, or install a local adapter for in-app execution.", docs: "https://hunter.io/api-documentation/", mcpUrl: "https://mcp.hunter.io/mcp" },
  { id: "prospeo", label: "Prospeo", credentialEnv: "PROSPEO_API_KEY", adapter: "external", setup: "Use Prospeo's official MCP from an external AI, or install a local adapter for in-app execution.", docs: "https://prospeo.io/api-docs", mcpUrl: "https://prospeo.io/api-docs/mcp" },
  { id: "snov", label: "Snov.io", credentialEnv: "SNOV_API_KEY", adapter: "external", setup: "Install a local adapter based on Snov.io's REST API.", docs: "https://snov.io/api" },
  { id: "custom_enrichment", label: "Custom enrichment service", credentialEnv: "ENRICHMENT_API_KEY", adapter: "external", setup: "Register a compatible local adapter; credentials remain in the backend environment.", docs: "/ADAPTER_CONTRACT.md" },
  { id: "none", label: "No provider", credentialEnv: "", adapter: "disabled", setup: "Contacts must be entered or imported manually.", docs: "/AI_OPERATOR_GUIDE.md" },
];

export const mailboxOptions: IntegrationOption[] = [
  { id: "outlook_graph", label: "Microsoft Outlook", credentialEnv: "", adapter: "external", setup: "Connect and authorize a compatible Microsoft Graph adapter, then map each profile to an account alias.", docs: "https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview" },
  { id: "gmail_api", label: "Gmail", credentialEnv: "", adapter: "external", setup: "Use an existing Gmail connector from an external AI, or install a Gmail API adapter and authorize each sender account through OAuth.", docs: "https://developers.google.com/workspace/gmail/api/guides" },
  { id: "imap_smtp", label: "Yahoo or IMAP/SMTP mail", credentialEnv: "MAIL_APP_PASSWORD", adapter: "external", setup: "Install an IMAP/SMTP adapter and use an app password or provider-approved OAuth flow.", docs: "https://help.yahoo.com/kb/SLN4075.html" },
  { id: "custom_mailbox", label: "Custom email service", credentialEnv: "MAIL_PROVIDER_TOKEN", adapter: "external", setup: "Register a compatible mailbox adapter for drafts, sends, and reply ingestion.", docs: "/ADAPTER_CONTRACT.md" },
  { id: "none", label: "Drafts only / no mailbox", credentialEnv: "", adapter: "disabled", setup: "The app can prepare plans, but cannot create drafts, send, or monitor replies.", docs: "/AI_OPERATOR_GUIDE.md" },
];

function selection(providerId: string, options: IntegrationOption[]): IntegrationSelection {
  const option = options.find((item) => item.id === providerId) ?? options[0];
  return { providerId: option.id, label: option.label, enabled: option.id !== "none", credentialEnv: option.credentialEnv };
}

export const defaultIntegrationSettings: IntegrationSettings = {
  version: 1,
  primaryEnrichment: selection("none", enrichmentOptions),
  fallbackEnrichment: { ...selection("none", enrichmentOptions), enabled: false },
  mailbox: selection("none", mailboxOptions),
};

export function selectIntegration(providerId: string, options: IntegrationOption[]): IntegrationSelection {
  return selection(providerId, options);
}

export function integrationOption(selectionValue: IntegrationSelection, options: IntegrationOption[]): IntegrationOption {
  return options.find((item) => item.id === selectionValue.providerId) ?? {
    id: selectionValue.providerId,
    label: selectionValue.label || "Custom provider",
    credentialEnv: selectionValue.credentialEnv,
    adapter: "external",
    setup: "Install and test a compatible local adapter.",
    docs: "/ADAPTER_CONTRACT.md",
  };
}

export function buildAdapterPrompt(option: IntegrationOption, role: string): string {
  const credentialInstruction = option.credentialEnv
    ? `Store the credential only in the ${option.credentialEnv} environment variable. Do not store the credential in browser storage, logs, tests, or committed files.`
    : "Use the provider's approved authorization store. Do not store credentials in browser storage, logs, tests, or committed files.";
  return `Configure ${option.label} for the ${role} role in Outreach Console. Read ${option.docs} and the local /ADAPTER_CONTRACT.md file. ${credentialInstruction} Prefer an official MCP or existing connector when operating externally; otherwise implement the smallest local adapter, add a non-billable connection test, preserve confirmation gates, and run the synthetic test suite before enabling provider actions.`;
}
