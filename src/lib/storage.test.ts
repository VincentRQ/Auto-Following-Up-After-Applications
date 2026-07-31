import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearLocalApplicationState, loadAiConnection, loadProfiles, normalizeAiConnectionSettings, normalizeProfileDefinitions, storageKeys } from "./storage";

class MemoryStorage implements Storage {
  #values = new Map<string, string>();

  get length(): number { return this.#values.size; }
  clear(): void { this.#values.clear(); }
  getItem(key: string): string | null { return this.#values.get(key) ?? null; }
  key(index: number): string | null { return [...this.#values.keys()][index] ?? null; }
  removeItem(key: string): void { this.#values.delete(key); }
  setItem(key: string, value: string): void { this.#values.set(key, String(value)); }
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
let localStorage: MemoryStorage;

beforeEach(() => {
  localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
});

afterEach(() => {
  restoreGlobal("window", originalWindow);
  restoreGlobal("indexedDB", originalIndexedDb);
});

describe("local application reset", () => {
  it("clears Outreach Console state without removing unrelated browser data", async () => {
    localStorage.setItem(storageKeys.jobs, "[]");
    localStorage.setItem(`${storageKeys.profiles}.recovery`, "recovery copy");
    localStorage.setItem("another-application.preference", "preserve me");

    await clearLocalApplicationState();

    expect(localStorage.getItem(storageKeys.jobs)).toBeNull();
    expect(localStorage.getItem(`${storageKeys.profiles}.recovery`)).toBeNull();
    expect(localStorage.getItem("another-application.preference")).toBe("preserve me");
  });

  it("recovers from malformed profile storage without crashing first launch", () => {
    localStorage.setItem(storageKeys.profiles, "[null]");
    const profiles = loadProfiles();
    expect(profiles).toHaveLength(4);
    expect(localStorage.getItem(`${storageKeys.profiles}.recovery`)).toContain("unexpected shape");
  });

  it("preserves a valid saved profile order and normalizes unsafe colors", () => {
    localStorage.setItem(storageKeys.profiles, JSON.stringify([
      { key: "project_manager", label: "Project Manager", senderName: "Your Name", accent: "url(https://tracker.invalid/pixel)" },
      { key: "data_analyst", label: "Data Analyst", senderName: "Your Name", accent: "#123456" },
    ]));
    const profiles = loadProfiles();
    expect(profiles.map((profile) => profile.key)).toEqual(["project_manager", "data_analyst"]);
    expect(profiles[0].accent).toBe("#48d597");
  });

  it("falls back from an unknown saved AI mode", () => {
    localStorage.setItem(storageKeys.aiConnection, JSON.stringify({ mode: "shell_exec", controlMode: "in_app", apiKeyEnv: "KEY;DROP" }));
    const value = loadAiConnection({ controlMode: "external_operator", mode: "manual", model: "", baseUrl: "", apiKeyEnv: "", strictPlanOnly: false });
    expect(value.mode).toBe("manual");
    expect(value.controlMode).toBe("in_app");
    expect(value.apiKeyEnv).toBe("KEYDROP");
  });

  it("normalizes untrusted workspace profiles and configuration values", () => {
    const profiles = normalizeProfileDefinitions([null]);
    expect(profiles).toHaveLength(4);
    const ai = normalizeAiConnectionSettings({ mode: "powershell" as never, controlMode: "in_app" }, { controlMode: "external_operator", mode: "manual", model: "", baseUrl: "", apiKeyEnv: "", strictPlanOnly: false });
    expect(ai.mode).toBe("manual");
  });
});

function restoreGlobal(key: "window" | "indexedDB", descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor);
  else Reflect.deleteProperty(globalThis, key);
}
