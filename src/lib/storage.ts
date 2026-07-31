import type {
  AiConnectionSettings,
  BatchInstructions,
  BatchReport,
  IntegrationSettings,
  JobRow,
  MessageDraft,
  OnboardingState,
  ProfileDefinition,
  SourceFileState,
  StorageSettings,
  WorkflowPreferences,
  WritingPreferences,
} from "../types";
import { DEFAULT_PROFILES } from "./profiles";
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
};

export function loadProfiles(): ProfileDefinition[] {
  return loadJson(storageKeys.profiles, DEFAULT_PROFILES, (value) => {
    return Array.isArray(value) && value.length > 0;
  }).filter((profile) => profile.key && profile.label && profile.accent);
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
  return { ...fallback, ...loadJson(storageKeys.aiConnection, {}, isObject) };
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

function isObject(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Workspace storage failed."));
  });
}
