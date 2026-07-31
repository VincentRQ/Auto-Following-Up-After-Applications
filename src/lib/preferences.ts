import type { StorageSettings, WorkflowPreferences, WritingPreferences } from "../types";

export const defaultStorageSettings: StorageSettings = {
  version: 1,
  mode: "browser",
  sqlitePath: "data/outreach.sqlite",
  externalDialect: "postgresql",
  externalAdapterUrl: "",
  externalWorkspaceId: "default",
  externalSyncMode: "manual",
  externalSchemaReady: false,
};

export const defaultWorkflowPreferences: WorkflowPreferences = {
  version: 1,
  colorTheme: "terminal",
  density: "compact",
  accentColor: "green",
  reduceMotion: false,
  defaultSpacingSeconds: 30,
  defaultContactTarget: 3,
  companyCooldownDays: 180,
  mailboxMonitorMinutes: 15,
  requireDraftReview: true,
  requireSendApproval: true,
  autoPrepareRedirectDrafts: true,
  modules: {
    calendar: true,
    profiles: true,
    mailbox: true,
    recovery: true,
    crm: true,
    statistics: true,
    debug: true,
  },
};

export const defaultWritingPreferences: WritingPreferences = {
  version: 1,
  mode: "external_llm",
  subjectTemplate: "{{role_title}} | {{job_id}}",
  bodyTemplate:
    "Hi {{recipient_first_name}},\n\nI noticed {{company}} is hiring for {{role_title}}, with a focus on {{responsibility}}. My background includes analytics delivery, reporting, and data quality work that overlaps with the role.\n\nI would be glad to connect if it would be useful. Thank you for your time.\n\nBest,\n{{sender_name}}",
  globalPrompt:
    "Write from the candidate's point of view. Use one concrete detail from the role, keep the message warm and specific, avoid sales language and generic AI phrasing, and do not invent experience. Keep the body within the configured word limit.",
  maximumWords: 80,
  requireIndividualReview: true,
};

export function normalizeStorageSettings(value: Partial<StorageSettings> | undefined): StorageSettings {
  const next = { ...defaultStorageSettings, ...(value ?? {}) };
  if (!["browser", "sqlite", "external"].includes(next.mode)) next.mode = "browser";
  if (!["postgresql", "mysql", "other"].includes(next.externalDialect)) next.externalDialect = "postgresql";
  next.sqlitePath = cleanLocalPath(next.sqlitePath, defaultStorageSettings.sqlitePath);
  next.externalAdapterUrl = cleanHttpUrl(next.externalAdapterUrl);
  next.externalWorkspaceId = String(next.externalWorkspaceId ?? "default").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "default";
  next.externalSyncMode = next.externalSyncMode === "automatic" ? "automatic" : "manual";
  next.externalSchemaReady = next.externalSchemaReady === true;
  return next;
}

export function normalizeWorkflowPreferences(value: Partial<WorkflowPreferences> | undefined): WorkflowPreferences {
  const modules = { ...defaultWorkflowPreferences.modules, ...(value?.modules ?? {}) };
  return {
    ...defaultWorkflowPreferences,
    ...(value ?? {}),
    version: 1,
    colorTheme: ["terminal", "light", "high_contrast"].includes(value?.colorTheme ?? "") ? value!.colorTheme! : defaultWorkflowPreferences.colorTheme,
    density: ["compact", "comfortable"].includes(value?.density ?? "") ? value!.density! : defaultWorkflowPreferences.density,
    accentColor: ["green", "cyan", "amber"].includes(value?.accentColor ?? "") ? value!.accentColor! : defaultWorkflowPreferences.accentColor,
    defaultSpacingSeconds: clampInteger(value?.defaultSpacingSeconds, 15, 3600, defaultWorkflowPreferences.defaultSpacingSeconds),
    defaultContactTarget: clampInteger(value?.defaultContactTarget, 1, 12, defaultWorkflowPreferences.defaultContactTarget),
    companyCooldownDays: clampInteger(value?.companyCooldownDays, 0, 3650, defaultWorkflowPreferences.companyCooldownDays),
    mailboxMonitorMinutes: clampInteger(value?.mailboxMonitorMinutes, 0, 1440, defaultWorkflowPreferences.mailboxMonitorMinutes),
    reduceMotion: value?.reduceMotion === true,
    requireDraftReview: value?.requireDraftReview !== false,
    requireSendApproval: value?.requireSendApproval !== false,
    autoPrepareRedirectDrafts: value?.autoPrepareRedirectDrafts !== false,
    modules,
  };
}

export function normalizeWritingPreferences(value: Partial<WritingPreferences> | undefined): WritingPreferences {
  const next = { ...defaultWritingPreferences, ...(value ?? {}) };
  if (!["template", "manual", "external_llm", "in_app_llm"].includes(next.mode)) next.mode = defaultWritingPreferences.mode;
  next.maximumWords = clampInteger(next.maximumWords, 20, 500, defaultWritingPreferences.maximumWords);
  next.requireIndividualReview = next.requireIndividualReview !== false;
  next.subjectTemplate = String(next.subjectTemplate ?? "").slice(0, 500);
  next.bodyTemplate = String(next.bodyTemplate ?? "").slice(0, 20_000);
  next.globalPrompt = String(next.globalPrompt ?? "").slice(0, 20_000);
  return next;
}

export function workflowAttributes(value: WorkflowPreferences): Record<string, string> {
  return {
    "data-theme": value.colorTheme,
    "data-density": value.density,
    "data-accent": value.accentColor,
    "data-reduce-motion": value.reduceMotion ? "true" : "false",
  };
}

function clampInteger(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(number)));
}

function cleanLocalPath(value: string | undefined, fallback: string): string {
  const next = String(value ?? "").trim();
  if (!next || next.includes("\0") || next.length > 500) return fallback;
  return next;
}

function cleanHttpUrl(value: string | undefined): string {
  const next = String(value ?? "").trim();
  if (!next) return "";
  try {
    const parsed = new URL(next);
    if (parsed.username || parsed.password) return "";
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}
