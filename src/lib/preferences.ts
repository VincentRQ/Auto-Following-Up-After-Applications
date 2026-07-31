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
  backgroundEffect: "scanlines",
  reduceMotion: false,
  defaultSpacingSeconds: 30,
  defaultContactTarget: 3,
  companyCooldownDays: 180,
  mailboxMonitorMinutes: 15,
  requireDraftReview: true,
  requireSendApproval: true,
  autoPrepareRedirectDrafts: true,
  leftPanelWidth: 280,
  rightPanelWidth: 330,
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
    "Hi {{recipient_first_name}},\n\nI saw {{company}} is hiring for {{role_title}}, with an emphasis on {{responsibility}}. My background includes {{profile_focus}}, which overlaps with that work. I applied and wanted to put my application on your radar. Would you be the right person to contact about the role?\n\nBest,\n{{sender_name}}",
  globalPrompt:
    "Write from the candidate's point of view in four short sentences after the greeting. Open with one factual responsibility from the job post, then connect one supplied profile strength to that work. State that the application was submitted and end with one easy routing question. Keep the complete body, including greeting and sign-off, under the configured word limit. Keep the subject clear and under 50 characters when practical. Do not open with 'I recently applied.' Do not invent praise, company problems, experience, names, identifiers, or results. Avoid sales language, urgency, generic AI phrasing, and more than one question or call to action.",
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
    colorTheme: ["terminal", "light", "graphite", "mulberry", "high_contrast"].includes(value?.colorTheme ?? "") ? value!.colorTheme! : defaultWorkflowPreferences.colorTheme,
    density: ["compact", "comfortable"].includes(value?.density ?? "") ? value!.density! : defaultWorkflowPreferences.density,
    accentColor: ["green", "cyan", "amber", "rose", "violet"].includes(value?.accentColor ?? "") ? value!.accentColor! : defaultWorkflowPreferences.accentColor,
    backgroundEffect: ["off", "scanlines", "grid_drift", "signal_sweep", "data_points", "circuit_traces"].includes(value?.backgroundEffect ?? "") ? value!.backgroundEffect! : defaultWorkflowPreferences.backgroundEffect,
    defaultSpacingSeconds: clampInteger(value?.defaultSpacingSeconds, 15, 3600, defaultWorkflowPreferences.defaultSpacingSeconds),
    defaultContactTarget: clampInteger(value?.defaultContactTarget, 1, 12, defaultWorkflowPreferences.defaultContactTarget),
    companyCooldownDays: clampInteger(value?.companyCooldownDays, 0, 3650, defaultWorkflowPreferences.companyCooldownDays),
    mailboxMonitorMinutes: clampInteger(value?.mailboxMonitorMinutes, 0, 1440, defaultWorkflowPreferences.mailboxMonitorMinutes),
    reduceMotion: value?.reduceMotion === true,
    requireDraftReview: value?.requireDraftReview !== false,
    requireSendApproval: value?.requireSendApproval !== false,
    autoPrepareRedirectDrafts: value?.autoPrepareRedirectDrafts !== false,
    leftPanelWidth: clampInteger(value?.leftPanelWidth, 220, 440, defaultWorkflowPreferences.leftPanelWidth),
    rightPanelWidth: clampInteger(value?.rightPanelWidth, 260, 520, defaultWorkflowPreferences.rightPanelWidth),
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
    "data-background-effect": value.backgroundEffect,
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
