import { describe, expect, it } from "vitest";
import { defaultStorageSettings, normalizeStorageSettings, normalizeWorkflowPreferences, normalizeWritingPreferences } from "./preferences";

describe("preference normalization", () => {
  it("keeps browser storage usable without a backend database", () => {
    expect(normalizeStorageSettings({ mode: "browser" }).mode).toBe("browser");
    expect(normalizeStorageSettings({ mode: "sqlite", sqlitePath: "" }).sqlitePath).toBe(defaultStorageSettings.sqlitePath);
  });

  it("bounds operational timing and contact settings", () => {
    const value = normalizeWorkflowPreferences({ defaultSpacingSeconds: 1, defaultContactTarget: 99, mailboxMonitorMinutes: -1, leftPanelWidth: 20, rightPanelWidth: 900 });
    expect(value.defaultSpacingSeconds).toBe(15);
    expect(value.defaultContactTarget).toBe(12);
    expect(value.mailboxMonitorMinutes).toBe(0);
    expect(value.leftPanelWidth).toBe(220);
    expect(value.rightPanelWidth).toBe(520);
  });

  it("keeps full themes and expanded accents", () => {
    expect(normalizeWorkflowPreferences({ colorTheme: "graphite", accentColor: "rose" }).colorTheme).toBe("graphite");
    expect(normalizeWorkflowPreferences({ colorTheme: "mulberry", accentColor: "violet" }).accentColor).toBe("violet");
    expect(normalizeWorkflowPreferences({ backgroundEffect: "circuit_traces" }).backgroundEffect).toBe("circuit_traces");
    expect(normalizeWorkflowPreferences({ backgroundEffect: "invalid" as never }).backgroundEffect).toBe("scanlines");
  });

  it("rejects unsafe external adapter protocols", () => {
    expect(normalizeStorageSettings({ mode: "external", externalAdapterUrl: "file:///private/data" }).externalAdapterUrl).toBe("");
    expect(normalizeStorageSettings({ mode: "external", externalAdapterUrl: "https://user:secret@db-adapter.example" }).externalAdapterUrl).toBe("");
    expect(normalizeStorageSettings({ mode: "external", externalAdapterUrl: "https://db-adapter.example/api/" }).externalAdapterUrl).toBe("https://db-adapter.example/api");
  });

  it("bounds writing length and preserves manual mode", () => {
    const value = normalizeWritingPreferences({ mode: "manual", maximumWords: 5 });
    expect(value.mode).toBe("manual");
    expect(value.maximumWords).toBe(20);
  });
});
