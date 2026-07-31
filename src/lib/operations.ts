import type { AiConnectionCheck, AiConnectionSettings, BackendHealth, BatchReport, BatchSettings, CrmCompany, CrmCompanyDetail, CrmContact, DashboardData, IntegrationSettings, JobRow, MailboxEvent, MessageDraft, OutreachHistoryItem, PreflightResult, QueueItem, RecoveryException, SetupStatus, WorkspaceResetPreview, WorkspaceResetResult, WorkspaceSnapshot } from "../types";
import { csvCell } from "./csv";
import { classifyContactQuality } from "./runner";

export function buildPreflight(jobs: JobRow[], settings: BatchSettings): PreflightResult {
  const selected = jobs.filter((job) => settings.selectedIds.includes(job.id) && job.profile === settings.profile);
  const queue = selected.map((job) => buildQueueItem(job, settings.contactTarget));
  const readyCount = queue.filter((item) => item.status === "ready").length;
  const blockedCount = queue.filter((item) => item.status === "blocked").length;
  const alreadySentCount = queue.filter((item) => item.status === "already_sent").length;
  const warnings: string[] = [];
  if (!selected.length) warnings.push("No jobs selected for the active profile.");
  if (blockedCount) warnings.push(`${blockedCount} selected jobs have blocking issues.`);
  if (alreadySentCount) warnings.push(`${alreadySentCount} selected jobs are already marked sent.`);
  if (settings.mode === "backend" && !settings.backendUrl.trim()) warnings.push("Backend mode requires a backend URL.");
  if (settings.spacingSeconds < 15) warnings.push("Spacing below 15 seconds is not recommended.");
  if (!settings.instructions.emailTemplate.trim()) warnings.push("Batch email template is empty.");
  if (!settings.instructions.targetInstructions.trim()) warnings.push("Targeting rules are empty.");
  return {
    selectedCount: selected.length,
    readyCount,
    blockedCount,
    alreadySentCount,
    estimatedDurationSeconds: Math.max(0, readyCount - 1) * settings.spacingSeconds,
    warnings,
    queue,
  };
}

export function buildBackendPayload(jobs: JobRow[], settings: BatchSettings) {
  const preflight = buildPreflight(jobs, settings);
  return {
    profile: settings.profile,
    scheduled_at: settings.scheduledAt,
    spacing_seconds: settings.spacingSeconds,
    contact_target: settings.contactTarget,
    instructions: settings.instructions,
    ai_connection: settings.aiConnection,
    queue: preflight.queue
      .filter((item) => item.status === "ready")
      .map((item) => ({
        source_row_id: item.id,
        company: item.company,
        role_title: item.roleTitle,
        job_id: item.jobId,
        job_url: item.jobUrl,
        profile: item.profile,
        contact_quality: item.contactQuality,
      })),
  };
}

export async function submitBackendBatch(jobs: JobRow[], settings: BatchSettings): Promise<string> {
  const endpoint = settings.backendUrl.trim().replace(/\/+$/, "");
  if (!endpoint) throw new Error("Backend URL is required.");
  const value = await requestBackend<unknown>(`${endpoint}/api/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildBackendPayload(jobs, settings)),
  }, false);
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function checkBackendHealth(backendUrl: string): Promise<BackendHealth> {
  const checkedAt = new Date().toISOString();
  const endpoint = backendUrl.trim().replace(/\/+$/, "");
  if (!endpoint) {
    return {
      status: "error",
      checkedAt,
      message: "Backend URL is not configured.",
      providers: {},
    };
  }
  try {
    const parsed = await fetchBackend<{ status?: string; message?: string; providers?: Record<string, string> }>(endpoint, "/api/health");
    return {
      status: parsed.status === "ok" ? "ok" : "unknown",
      checkedAt,
      message: parsed.message || "Backend health response received.",
      providers: parsed.providers ?? {},
    };
  } catch (error) {
    return {
      status: "error",
      checkedAt,
      message: error instanceof Error ? error.message : "Backend health check failed.",
      providers: {},
    };
  }
}

export async function fetchCrmCompanies(backendUrl: string): Promise<CrmCompany[]> {
  const value = await fetchBackend<{ companies: CrmCompany[] }>(backendUrl, "/api/crm/companies");
  return value.companies;
}

export function fetchCrmCompany(backendUrl: string, companyId: number): Promise<CrmCompanyDetail> {
  return fetchBackend<CrmCompanyDetail>(backendUrl, `/api/crm/companies/${companyId}`);
}

export function addCrmContact(backendUrl: string, companyId: number, contact: { name: string; title: string; email: string; source: string; tier: number; confidence: number }): Promise<CrmContact> {
  return mutateBackend<CrmContact>(backendUrl, `/api/crm/companies/${companyId}/contacts`, contact);
}

export function recordHistoricalOutreach(backendUrl: string, companyId: number, entry: { contact_id: number | null; job_id: number | null; profile: string; status: string; subject: string; occurred_at: string }): Promise<OutreachHistoryItem> {
  return mutateBackend<OutreachHistoryItem>(backendUrl, `/api/crm/companies/${companyId}/outreach`, entry);
}

export function setCrmCompanySuppression(backendUrl: string, companyId: number, suppressed: boolean, reason = "manual suppression"): Promise<{ suppressed: boolean }> {
  return mutateBackend(backendUrl, `/api/crm/companies/${companyId}/suppression`, { suppressed, reason });
}

export async function fetchRecoveryExceptions(backendUrl: string): Promise<RecoveryException[]> {
  const value = await fetchBackend<{ exceptions: RecoveryException[] }>(backendUrl, "/api/exceptions");
  return value.exceptions;
}

export function resolveRecoveryException(backendUrl: string, exceptionId: number, resolution: "completed" | "dismissed" | "deferred"): Promise<{ state: string }> {
  return mutateBackend(backendUrl, `/api/exceptions/${exceptionId}/resolve`, { resolution });
}

export async function fetchMailboxEvents(backendUrl: string, state = "attention"): Promise<MailboxEvent[]> {
  const value = await fetchBackend<{ events: MailboxEvent[] }>(backendUrl, `/api/mailbox/events?state=${encodeURIComponent(state)}`);
  return value.events;
}

export function syncMailboxEvents(backendUrl: string): Promise<{ scanned: number; inserted: number; matched: number; unmatched: number; errors?: Array<{ account: string; message: string }> }> {
  return mutateBackend(backendUrl, "/api/mailbox/sync", { top: 100, apply: true });
}

export function reviewMailboxEvent(backendUrl: string, eventId: number, input: { company_id?: number; job_id?: number; dismissed?: boolean }): Promise<{ state: string }> {
  return mutateBackend(backendUrl, `/api/mailbox/events/${eventId}/review`, input);
}

export function fetchDashboard(backendUrl: string): Promise<DashboardData> { return fetchBackend(backendUrl, "/api/dashboard"); }
export function fetchSetupStatus(backendUrl: string): Promise<SetupStatus> { return fetchBackend(backendUrl, "/api/setup/status"); }
export function saveIntegrationPreferences(backendUrl: string, settings: IntegrationSettings): Promise<{ integrations: IntegrationSettings; providers?: SetupStatus["providers"] }> { return mutateBackend(backendUrl, "/api/setup/integrations", settings); }
export async function downloadIncidentReport(backendUrl: string): Promise<void> { const report = await fetchBackend<unknown>(backendUrl, "/api/incidents/report"); downloadJson(`outreach-incident-${new Date().toISOString().slice(0, 10)}.json`, report); }
export function previewWorkspaceReset(backendUrl: string): Promise<WorkspaceResetPreview> { return mutateBackend(backendUrl, "/api/system/reset/preview", {}); }
export function resetBackendWorkspace(backendUrl: string, token: string, confirmation: string): Promise<WorkspaceResetResult> { return mutateBackend(backendUrl, "/api/system/reset", { token, confirmation }); }
export function checkAiConnection(backendUrl: string, input: AiConnectionSettings): Promise<AiConnectionCheck> { return mutateBackend(backendUrl, "/api/writing/check", input); }
export function generateMessages(backendUrl: string, input: { brief: string; drafts: MessageDraft[]; maximum_words: number; ai_connection: AiConnectionSettings }): Promise<Array<{ draft_id: string; subject: string; body: string }>> {
  return mutateBackend<{ messages: Array<{ draft_id: string; subject: string; body: string }> }>(backendUrl, "/api/writing/generate", input).then((value) => value.messages);
}

export async function checkExternalStorageAdapter(adapterUrl: string): Promise<{ status: string; schemaReady: boolean; detail: string }> {
  const endpoint = validateHttpEndpoint(adapterUrl, false);
  const value = await requestBackend<{ status?: string; schema_ready?: boolean; detail?: string }>(`${endpoint}/v1/health`, { method: "GET" }, true);
  return {
    status: value.status ?? "unknown",
    schemaReady: value.schema_ready === true,
    detail: value.detail ?? "External adapter responded.",
  };
}

export async function saveExternalWorkspace(adapterUrl: string, workspaceId: string, snapshot: WorkspaceSnapshot): Promise<void> {
  const endpoint = validateHttpEndpoint(adapterUrl, false);
  await requestBackend(`${endpoint}/v1/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  }, false);
}

export async function loadExternalWorkspace(adapterUrl: string, workspaceId: string): Promise<WorkspaceSnapshot | null> {
  const endpoint = validateHttpEndpoint(adapterUrl, false);
  return requestBackend<WorkspaceSnapshot | null>(`${endpoint}/v1/workspaces/${encodeURIComponent(workspaceId)}`, { method: "GET" }, true);
}

async function fetchBackend<T>(backendUrl: string, path: string): Promise<T> {
  const endpoint = validateHttpEndpoint(backendUrl, true);
  return requestBackend<T>(`${endpoint}${path}`, { method: "GET" }, true);
}

async function mutateBackend<T>(backendUrl: string, path: string, body: unknown): Promise<T> {
  const endpoint = validateHttpEndpoint(backendUrl, true);
  return requestBackend<T>(`${endpoint}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, false);
}

export function validateHttpEndpoint(value: string, loopbackOnly: boolean): string {
  const input = value.trim();
  if (!input) throw new Error(loopbackOnly ? "Backend URL is required." : "External database adapter URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Enter a complete HTTP or HTTPS URL.");
  }
  if (parsed.username || parsed.password) throw new Error("Do not place credentials in a service URL.");
  const host = parsed.hostname.toLowerCase();
  const loopback = host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
  if (loopbackOnly && !loopback) throw new Error("The local backend URL must use localhost or a loopback address.");
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error("Remote adapters require HTTPS. HTTP is allowed only on a loopback address.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

async function requestBackend<T>(url: string, init: RequestInit, retryRead: boolean): Promise<T> {
  const attempts = retryRead ? 2 : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(readErrorMessage(text, response.status));
        if (retryRead && response.status >= 500 && attempt + 1 < attempts) { lastError = error; continue; }
        throw error;
      }
      if (!text) return {} as T;
      try { return JSON.parse(text) as T; } catch { throw new Error("The local service returned an unreadable response."); }
    } catch (error) {
      lastError = error;
      if (!retryRead || attempt + 1 >= attempts || (error instanceof Error && !isRetryableReadError(error))) throw normalizeRequestError(error);
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw normalizeRequestError(lastError);
}

function isRetryableReadError(error: Error): boolean {
  return error.name === "AbortError" || /fetch|network|failed|backend returned 5\d\d/i.test(error.message);
}
function normalizeRequestError(error: unknown): Error {
  if (error instanceof DOMException && error.name === "AbortError") return new Error("The local service did not respond within 10 seconds.");
  return error instanceof Error ? error : new Error("The local service request failed.");
}
function readErrorMessage(text: string, status: number): string {
  try { const value = JSON.parse(text) as { error?: string }; return value.error || `Local service returned ${status}.`; }
  catch { return text || `Local service returned ${status}.`; }
}

export function downloadJson(fileName: string, value: unknown): void {
  downloadText(fileName, JSON.stringify(value, null, 2), "application/json");
}

export function reportToCsv(report: BatchReport): string {
  const rows = [
    ["run_id", "profile", "company", "role_title", "job_id", "outcome", "contact_quality", "details"],
    ...report.items.map((item) => [
      report.runId,
      report.profile,
      item.company,
      item.roleTitle,
      item.jobId,
      item.outcome,
      item.contactQuality,
      item.details.join("; "),
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadText(fileName: string, value: string, type = "text/plain"): void {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildQueueItem(job: JobRow, contactTarget: number): QueueItem {
  const blockers: string[] = [];
  const contactQuality = classifyContactQuality(job, contactTarget);
  if (!job.company) blockers.push("missing company");
  if (!job.roleTitle) blockers.push("missing role");
  if (!job.jobUrl) blockers.push("missing job URL");
  if (job.profile === "unassigned") blockers.push("unassigned profile");
  if (contactQuality === "missing") blockers.push("no clean contacts");
  if (job.status === "sent" || job.sentAt) {
    return {
      id: job.id,
      jobId: job.jobId,
      company: job.company,
      roleTitle: job.roleTitle,
      profile: job.profile,
      jobUrl: job.jobUrl,
      status: "already_sent",
      contactQuality,
      blockers,
    };
  }
  return {
    id: job.id,
    jobId: job.jobId,
    company: job.company,
    roleTitle: job.roleTitle,
    profile: job.profile,
    jobUrl: job.jobUrl,
    status: blockers.length ? "blocked" : "ready",
    contactQuality,
    blockers,
  };
}
