import type {
  AiConnectionSettings,
  BatchInstructions,
  BatchReport,
  CalendarPreferences,
  DailyQueueState,
  IntegrationSettings,
  JobRow,
  MessageDraft,
  OnboardingState,
  ProfileDefinition,
  SourceFileState,
  StorageSettings,
  WorkflowPreferences,
  WritingPreferences,
  WorkspaceTutorialState,
} from "../types";
import { createDefaultProfiles } from "./profiles";
import { normalizeCalendarPreferences } from "./calendar";
import { normalizeStorageSettings, normalizeWorkflowPreferences, normalizeWritingPreferences } from "./preferences";

const prefix = "outreach-console.";
const databaseName = "outreach-console-workspace";
const workspaceStore = "workspace";
const jobsRecord = "jobs";

export const storageKeys = {
  profiles: `${prefix}profiles`,
  instructions: `${prefix}instructions`,
  jobs: `${prefix}jobs`,
  reports: `${prefix}reports`,
  backendUrl: `${prefix}backend-url`,
  aiConnection: `${prefix}ai-connection`,
  sourceState: `${prefix}source-state`,
  integrations: `${prefix}integrations`,
  onboarding: `${prefix}onboarding`,
  storage: `${prefix}storage`,
  workflow: `${prefix}workflow`,
  writing: `${prefix}writing`,
  drafts: `${prefix}drafts`,
  tutorial: `${prefix}tutorial`,
  calendar: `${prefix}calendar`,
  dailyQueue: `${prefix}daily-queue`,
};

export function loadProfiles(): ProfileDefinition[] {
  const profiles = loadJson(storageKeys.profiles, createDefaultProfiles(), isProfileArray);
  return normalizeProfileDefinitions(profiles);
}

export function normalizeProfileDefinitions(value: unknown, fallback = createDefaultProfiles()): ProfileDefinition[] {
  const profiles = isProfileArray(value) ? value : fallback;
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (seen.has(profile.key)) return false;
    seen.add(profile.key);
    return true;
  }).map((profile) => ({
    key: profile.key.slice(0, 40),
    label: profile.label.slice(0, 100),
    senderName: profile.senderName.slice(0, 150),
    senderEmail: String(profile.senderEmail ?? "").slice(0, 320),
    resumeLabel: String(profile.resumeLabel ?? "").slice(0, 500),
    notes: String(profile.notes ?? "").slice(0, 2_000),
    accent: /^#[0-9a-f]{6}$/i.test(profile.accent) ? profile.accent : "#48d597",
  }));
}

export function loadInstructions(defaultInstructions: BatchInstructions): BatchInstructions {
  return { ...defaultInstructions, ...loadJson(storageKeys.instructions, {}, isObject) };
}

export function loadJobs(): JobRow[] {
  return loadJson(storageKeys.jobs, [], Array.isArray);
}

export async function loadStoredJobs(): Promise<JobRow[]> {
  if (typeof indexedDB === "undefined") return loadJobs();
  const database = await openWorkspaceDatabase();
  const stored = await requestResult(database.transaction(workspaceStore, "readonly").objectStore(workspaceStore).get(jobsRecord));
  database.close();
  if (Array.isArray(stored)) return stored as JobRow[];

  const legacy = loadJobs();
  if (legacy.length) await saveStoredJobs(legacy);
  return legacy;
}

export async function saveStoredJobs(jobs: JobRow[]): Promise<void> {
  if (typeof indexedDB === "undefined") {
    saveJson(storageKeys.jobs, jobs);
    return;
  }
  const database = await openWorkspaceDatabase();
  await requestResult(database.transaction(workspaceStore, "readwrite").objectStore(workspaceStore).put(jobs, jobsRecord));
  database.close();
  window.localStorage.removeItem(storageKeys.jobs);
}

export function loadReports(): BatchReport[] {
  return loadJson(storageKeys.reports, [], Array.isArray);
}

export function loadString(key: string, fallback = ""): string {
  return window.localStorage.getItem(key) ?? fallback;
}

export function loadAiConnection(fallback: AiConnectionSettings): AiConnectionSettings {
  const stored = loadJson<Partial<AiConnectionSettings>>(storageKeys.aiConnection, {}, isObject);
  return normalizeAiConnectionSettings(stored, fallback);
}

export function saveAiConnection(value: AiConnectionSettings): void {
  saveJson(storageKeys.aiConnection, {
    controlMode: value.controlMode,
    mode: value.mode,
    model: value.model,
    baseUrl: value.baseUrl,
    strictPlanOnly: value.strictPlanOnly,
  });
}

export function normalizeAiConnectionSettings(value: Partial<AiConnectionSettings> | undefined, fallback: AiConnectionSettings): AiConnectionSettings {
  const stored = isObject(value) ? value : {};
  const modes = new Set<AiConnectionSettings["mode"]>(["codex_cli", "claude_cli", "cursor_cli", "opencode_cli", "ollama", "openai_api", "anthropic_api", "gemini_api", "groq_api", "openrouter_api", "deepseek_api", "kimi_api", "mistral_api", "together_api", "cerebras_api", "openai_compatible", "manual"]);
  const controls = new Set<AiConnectionSettings["controlMode"]>(["external_operator", "in_app", "templates_only"]);
  const mode = modes.has(stored.mode as AiConnectionSettings["mode"]) ? stored.mode! : fallback.mode;
  return {
    controlMode: controls.has(stored.controlMode as AiConnectionSettings["controlMode"]) ? stored.controlMode! : fallback.controlMode,
    mode,
    model: String(stored.model ?? fallback.model).slice(0, 200),
    baseUrl: String(stored.baseUrl ?? fallback.baseUrl).slice(0, 2_000),
    apiKeyEnv: fixedCredentialVariable(mode) || String(fallback.apiKeyEnv).toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 100),
    strictPlanOnly: stored.strictPlanOnly === true,
  };
}

function fixedCredentialVariable(mode: unknown): string {
  const names: Partial<Record<AiConnectionSettings["mode"], string>> = {
    openai_api: "OPENAI_API_KEY",
    anthropic_api: "ANTHROPIC_API_KEY",
    gemini_api: "GEMINI_API_KEY",
    groq_api: "GROQ_API_KEY",
    openrouter_api: "OPENROUTER_API_KEY",
    deepseek_api: "DEEPSEEK_API_KEY",
    kimi_api: "MOONSHOT_API_KEY",
    mistral_api: "MISTRAL_API_KEY",
    together_api: "TOGETHER_API_KEY",
    cerebras_api: "CEREBRAS_API_KEY",
  };
  return names[mode as AiConnectionSettings["mode"]] ?? "";
}

export function loadSourceState(fallback: SourceFileState): SourceFileState {
  return { ...fallback, ...loadJson(storageKeys.sourceState, {}, isObject) };
}

export function loadIntegrationSettings(fallback: IntegrationSettings): IntegrationSettings {
  const stored = loadJson<Partial<IntegrationSettings>>(storageKeys.integrations, {}, isObject);
  return {
    ...fallback,
    ...stored,
    primaryEnrichment: { ...fallback.primaryEnrichment, ...stored.primaryEnrichment },
    fallbackEnrichment: { ...fallback.fallbackEnrichment, ...stored.fallbackEnrichment },
    mailbox: { ...fallback.mailbox, ...stored.mailbox },
  };
}

export function loadOnboardingState(fallback: OnboardingState): OnboardingState {
  return { ...fallback, ...loadJson(storageKeys.onboarding, {}, isObject) };
}

export function loadStorageSettings(fallback: StorageSettings): StorageSettings {
  return normalizeStorageSettings({ ...fallback, ...loadJson(storageKeys.storage, {}, isObject) });
}

export function loadWorkflowPreferences(fallback: WorkflowPreferences): WorkflowPreferences {
  return normalizeWorkflowPreferences({ ...fallback, ...loadJson(storageKeys.workflow, {}, isObject) });
}

export function loadWritingPreferences(fallback: WritingPreferences): WritingPreferences {
  return normalizeWritingPreferences({ ...fallback, ...loadJson(storageKeys.writing, {}, isObject) });
}

export function loadMessageDrafts(): MessageDraft[] {
  return loadJson<MessageDraft[]>(storageKeys.drafts, [], Array.isArray).filter((item) => Boolean(item?.id && item?.jobRowId));
}

export function loadWorkspaceTutorialState(fallback: WorkspaceTutorialState): WorkspaceTutorialState {
  const stored = loadJson<Partial<WorkspaceTutorialState>>(storageKeys.tutorial, {}, isObject);
  return {
    version: 1,
    completed: stored.completed === true,
    skipped: stored.skipped === true,
    lastStep: Number.isFinite(stored.lastStep) ? Math.max(0, Math.floor(stored.lastStep ?? 0)) : fallback.lastStep,
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : fallback.updatedAt,
  };
}

export function loadCalendarPreferences(fallback: CalendarPreferences): CalendarPreferences {
  const stored = loadJson<Partial<CalendarPreferences>>(storageKeys.calendar, {}, isObject);
  return normalizeCalendarPreferences({
    ...fallback,
    ...stored,
    includedKinds: isObject(stored.includedKinds)
      ? { ...fallback.includedKinds, ...stored.includedKinds }
      : fallback.includedKinds,
  });
}

export function loadDailyQueueState(fallback: DailyQueueState): DailyQueueState {
  const stored = loadJson<Partial<DailyQueueState>>(storageKeys.dailyQueue, {}, isObject);
  const destinations = new Set(["today", "jobs", "writing", "activity", "settings"]);
  return {
    version: 1,
    date: typeof stored.date === "string" ? stored.date : fallback.date,
    jobIds: Array.isArray(stored.jobIds) ? [...new Set(stored.jobIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200))].slice(0, 500) : fallback.jobIds,
    lastDestination: typeof stored.lastDestination === "string" && destinations.has(stored.lastDestination) ? stored.lastDestination : fallback.lastDestination,
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : fallback.updatedAt,
  };
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to persist ${key} in local storage.`, error);
  }
}

export function saveString(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

export async function clearLocalApplicationState(): Promise<void> {
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) window.localStorage.removeItem(key);
  if (typeof indexedDB !== "undefined") await deleteWorkspaceDatabase();
}

function loadJson<T>(key: string, fallback: T, guard: (value: unknown) => boolean): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (guard(parsed)) return parsed as T;
    preserveCorruptValue(key, raw, "Stored value has an unexpected shape.");
    return fallback;
  } catch (error) {
    if (raw) preserveCorruptValue(key, raw, error instanceof Error ? error.message : "Unable to parse stored value.");
    return fallback;
  }
}

function preserveCorruptValue(key: string, raw: string, reason: string): void {
  try {
    window.localStorage.setItem(`${key}.recovery`, JSON.stringify({ capturedAt: new Date().toISOString(), reason, raw }));
    console.warn(`Recovered from invalid local storage at ${key}.`, reason);
  } catch {
    // Storage may be unavailable or full; loading the fallback still keeps the app usable.
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProfileArray(value: unknown): value is ProfileDefinition[] {
  return Array.isArray(value) && value.length > 0 && value.every((profile) =>
    isObject(profile)
    && typeof profile.key === "string"
    && /^[a-z0-9_]{1,40}$/.test(profile.key)
    && typeof profile.label === "string"
    && Boolean(profile.label.trim())
    && typeof profile.senderName === "string"
    && typeof profile.accent === "string",
  );
}

function openWorkspaceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(workspaceStore)) request.result.createObjectStore(workspaceStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open workspace storage."));
  });
}

function deleteWorkspaceDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to clear workspace storage."));
    request.onblocked = () => reject(new Error("Workspace storage is still open in another tab. Close other Outreach Console tabs and try again."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Workspace storage failed."));
  });
}
