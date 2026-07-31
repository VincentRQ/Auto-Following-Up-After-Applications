import { describe, expect, it } from "vitest";
import { buildAdapterPrompt, defaultIntegrationSettings, enrichmentOptions, integrationOption, selectIntegration } from "./integrations";

describe("integration settings", () => {
  it("defaults to the legacy operational stack without making the fallback mandatory", () => {
    expect(defaultIntegrationSettings.primaryEnrichment.providerId).toBe("none");
    expect(defaultIntegrationSettings.fallbackEnrichment.providerId).toBe("none");
    expect(defaultIntegrationSettings.fallbackEnrichment.enabled).toBe(false);
    expect(defaultIntegrationSettings.mailbox.providerId).toBe("none");
  });

  it("marks unsupported services as external adapters", () => {
    const hunter = selectIntegration("hunter", enrichmentOptions);
    expect(hunter.label).toBe("Hunter");
    const option = integrationOption(hunter, enrichmentOptions);
    expect(option.adapter).toBe("external");
    expect(option.docs).toBe("https://hunter.io/api-documentation/");
    expect(option.mcpUrl).toBe("https://mcp.hunter.io/mcp");
  });

  it("builds a bounded installation prompt from official provider details", () => {
    const option = integrationOption(selectIntegration("prospeo", enrichmentOptions), enrichmentOptions);
    const prompt = buildAdapterPrompt(option, "fallback contact discovery");
    expect(prompt).toContain("Prospeo");
    expect(prompt).toContain("https://prospeo.io/api-docs");
    expect(prompt).toContain("PROSPEO_API_KEY");
    expect(prompt).toContain("ADAPTER_CONTRACT.md");
    expect(prompt).toContain("Do not store the credential");
  });
});
