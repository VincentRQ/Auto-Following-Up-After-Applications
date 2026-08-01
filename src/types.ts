export type ProfileKey = string;

export type JobStatus =
  | "applied"
  | "application_received"
  | "queued"
  | "sent"
  | "replied"
  | "rejected"
  | "bounced"
  | "interview"
  | "needs_review"
  | "skipped"
  | "drafted"
  | "unknown";

export type ContactQuality = "clean" | "thin" | "missing";
export type RunMode = "dry_run" | "backend";
export type QueueItemStatus = "ready" | "blocked" | "already_sent";

export interface JobRow {
  id: string;
  originalRow: number;
  profile: ProfileKey;
  profileLabel: string;
  company: string;
  roleTitle: string;
  jobDescription?: string;
  jobUrl: string;
  jobId: string;
  source: string;
  status: JobStatus;
  statusDetail?: string;
  appliedAt: string;
  lastWorkedAt: string;
  sentAt: string;
  followUpDueAt?: string;
  contactsFound: number | null;
  notes: string;
  importedAt: string;
  extraFields?: Record<string, string>;
}

export interface WorkbookImportResult {
  fileName: string;
  sheetName: string;
  rows: JobRow[];
  warnings: string[];
  columns: string[];
  missingRequiredColumns: string[];
  availableSheets: string[];
  importedSheets: string[];
}

export type SourceMode = "none" | "linked" | "uploaded" | "manual" | "sample";
export type SourceSyncState = "idle" | "synced" | "saving" | "changed" | "conflict" | "error";

export interface SourceFileState {
  mode: SourceMode;
  fileName: string;
  format: "csv" | "xlsx" | "unknown";
  syncState: SourceSyncState;
  lastSyncedAt: string;
  lastModified: number;
  message: string;
}

export type AiConnectionMode = "codex_cli" | "claude_cli" | "cursor_cli" | "opencode_cli" | "ollama" | "openai_api" | "anthropic_api" | "gemini_api" | "groq_api" | "openrouter_api" | "deepseek_api" | "kimi_api" | "mistral_api" | "together_api" | "cerebras_api" | "openai_compatible" | "manual";
export type AiControlMode = "external_operator" | "in_app" | "templates_only";

export interface AiConnectionSettings {
  controlMode: AiControlMode;
  mode: AiConnectionMode;
  model: string;
  baseUrl: string;
  apiKeyEnv: string;
  strictPlanOnly: boolean;
}

export type AiConnectionCheckStatus = "checking" | "ready" | "not_installed" | "not_authenticated" | "adapter_required" | "unsupported" | "error";

export interface AiConnectionCheck {
  mode: AiConnectionMode;
  label: string;
  status: AiConnectionCheckStatus;
  installed: boolean;
  authenticated: boolean;
  detail: string;
  nextCommand: string;
  version: string;
  availableModels: string[];
}

export type StorageMode = "browser" | "sqlite" | "external";
export type ExternalDatabaseDialect = "postgresql" | "mysql" | "other";

export interface StorageSettings {
  version: 1;
  mode: StorageMode;
  sqlitePath: string;
  externalDialect: ExternalDatabaseDialect;
  externalAdapterUrl: string;
  externalWorkspaceId: string;
  externalSyncMode: "manual" | "automatic";
  externalSchemaReady: boolean;
}

export type ColorTheme = "terminal" | "light" | "graphite" | "mulberry" | "high_contrast";
export type InterfaceMode = "simple" | "advanced";
export type InterfaceDensity = "compact" | "comfortable";
export type AccentColor = "green" | "cyan" | "amber" | "rose" | "violet";
export type BackgroundEffect = "off" | "scanlines" | "grid_drift" | "signal_sweep" | "data_points" | "circuit_traces";

export interface ModuleVisibility {
  calendar: boolean;
  profiles: boolean;
  mailbox: boolean;
  recovery: boolean;
  crm: boolean;
  statistics: boolean;
  debug: boolean;
}

export interface WorkflowPreferences {
  version: 2;
  interfaceMode: InterfaceMode;
  showProcessRail: boolean;
  showGuidancePanel: boolean;
  colorTheme: ColorTheme;
  density: InterfaceDensity;
  accentColor: AccentColor;
  backgroundEffect: BackgroundEffect;
  reduceMotion: boolean;
  defaultSpacingSeconds: number;
  defaultContactTarget: number;
  companyCooldownDays: number;
  mailboxMonitorMinutes: number;
  requireDraftReview: boolean;
  requireSendApproval: boolean;
  autoPrepareRedirectDrafts: boolean;
  followUpDays: number;
  dailyQueueLimit: number;
  dailySummaryEnabled: boolean;
  providerCreditMode: "ask" | "allow" | "never";
  leftPanelWidth: number;
  rightPanelWidth: number;
  modules: ModuleVisibility;
}

export interface DailyQueueState {
  version: 1;
  date: string;
  jobIds: string[];
  lastDestination: string;
  updatedAt: string;
}

export interface WorkspaceTutorialState {
  version: 1;
  completed: boolean;
  skipped: boolean;
  lastStep: number;
  updatedAt: string;
}

export type CalendarEventKind = "application" | "outreach" | "interview" | "reply" | "rejection" | "bounce" | "confirmation";
export type CalendarExportScope = "visible_month" | "all_events";
export type CalendarDestination = "google" | "outlook" | "apple" | "other";

export interface CalendarPreferences {
  version: 1;
  destination: CalendarDestination;
  exportScope: CalendarExportScope;
  reminderMinutes: 0 | 10 | 30 | 60 | 1440;
  includedKinds: Record<CalendarEventKind, boolean>;
}

export type DraftWritingMode = "template" | "manual" | "external_llm" | "in_app_llm";
export type MessageDraftStatus = "needs_recipient" | "needs_writing" | "ready" | "approved" | "created" | "sent";

export interface WritingPreferences {
  version: 1;
  mode: DraftWritingMode;
  subjectTemplate: string;
  bodyTemplate: string;
  globalPrompt: string;
  maximumWords: number;
  requireIndividualReview: boolean;
}

export interface MessageDraft {
  id: string;
  jobRowId: string;
  slot: number;
  profile: ProfileKey;
  company: string;
  roleTitle: string;
  jobId: string;
  jobUrl: string;
  recipientName: string;
  recipientEmail: string;
  recipientTitle: string;
  mode: DraftWritingMode;
  subject: string;
  body: string;
  promptOverride: string;
  status: MessageDraftStatus;
  updatedAt: string;
}

export interface ProfileDefinition {
  key: ProfileKey;
  label: string;
  senderName: string;
  senderEmail?: string;
  resumeLabel?: string;
  notes?: string;
  accent: string;
}

export interface BatchInstructions {
  emailTemplate: string;
  targetInstructions: string;
  aiInstructions: string;
}

export interface BatchSettings {
  profile: ProfileKey;
  scheduledAt: string;
  spacingSeconds: number;
  contactTarget: number;
  selectedIds: string[];
  instructions: BatchInstructions;
  mode: RunMode;
  backendUrl: string;
  aiConnection?: AiConnectionSettings;
}

export interface QueueItem {
  id: string;
  jobId: string;
  company: string;
  roleTitle: string;
  profile: ProfileKey;
  jobUrl: string;
  status: QueueItemStatus;
  contactQuality: ContactQuality;
  blockers: string[];
}

export interface PreflightResult {
  selectedCount: number;
  readyCount: number;
  blockedCount: number;
  alreadySentCount: number;
  estimatedDurationSeconds: number;
  warnings: string[];
  queue: QueueItem[];
}

export interface ReportItem {
  jobId: string;
  company: string;
  roleTitle: string;
  outcome: "prepared" | "skipped" | "already_sent";
  contactQuality: ContactQuality;
  details: string[];
}

export interface BatchReport {
  runId: string;
  profile: ProfileKey;
  createdAt: string;
  scheduledAt: string;
  instructions: BatchInstructions;
  mode: RunMode;
  backendUrl: string;
  backendStatus: "not_used" | "submitted" | "failed";
  backendMessage: string;
  totalSelected: number;
  prepared: number;
  alreadySent: number;
  skipped: number;
  cleanContactGaps: number;
  items: ReportItem[];
}

export interface BackendHealth {
  status: "unknown" | "ok" | "error";
  checkedAt: string;
  message: string;
  providers: Record<string, string>;
}

export interface CrmContact {
  id: number;
  name: string;
  title: string;
  email: string;
  source: string;
  confidence: number;
  tier: number;
  suppression_reason: string;
  last_contacted_at: string;
}

export interface CrmCompany {
  id: number;
  name: string;
  domain: string;
  suppression_reason: string;
  job_count: number;
  contact_count: number;
  last_contacted_at: string;
  contacts: CrmContact[];
}

export interface CrmJob {
  id: number;
  external_id: string;
  role_title: string;
  job_url: string;
  profile: string;
  created_at: string;
}

export interface OutreachHistoryItem {
  id: number;
  job_id: number | null;
  contact_id: number | null;
  profile: string;
  channel: string;
  status: string;
  subject: string;
  occurred_at: string;
  contact_name?: string;
  contact_email?: string;
  role_title?: string;
}

export interface CrmCompanyDetail extends CrmCompany {
  jobs: CrmJob[];
  outreach: OutreachHistoryItem[];
  exceptions: RecoveryException[];
  events: Array<{ id: number; event_type: string; created_at: string; payload: Record<string, unknown> }>;
}

export interface RecoveryException {
  id: number;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  type: string;
  state: string;
  severity: string;
  created_at: string;
  proposedAction: {
    kind: string;
    target: string;
    note?: string;
    consecutiveFailures?: number;
  };
}

export interface MailboxEvent {
  id: number;
  account: string;
  received_at: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  classification: string;
  proposed_status: string;
  confidence: number;
  state: string;
  company_id: number | null;
  job_id: number | null;
  company_name?: string;
  role_title?: string;
}

export interface DashboardData {
  statuses: Array<{ status: string; count: number }>;
  outreachStatuses?: Array<{ status: string; count: number }>;
  activity: { last7Days: number; last30Days: number; dailyAverage7: number; dailyAverage30: number };
  usage: Array<{ provider: string; operation: string; requests: number; credits: number; failures: number }>;
  totals: { companies: number; contacts: number; jobs: number };
}

export interface SetupStatus {
  publicSampleMode: boolean;
  liveSendEnabled: boolean;
  profiles: Array<{ profile: string; account: string; resumeConfigured: boolean }>;
  providerStatus: Record<string, string>;
  integrations?: IntegrationSettings;
  providers?: ProviderConnectionStatus[];
}

export type IntegrationRole = "primary_enrichment" | "fallback_enrichment" | "mailbox";

export interface IntegrationSelection {
  providerId: string;
  label: string;
  enabled: boolean;
  credentialEnv: string;
}

export interface IntegrationSettings {
  version: 1;
  primaryEnrichment: IntegrationSelection;
  fallbackEnrichment: IntegrationSelection;
  mailbox: IntegrationSelection;
}

export interface ProviderConnectionStatus {
  role: IntegrationRole;
  providerId: string;
  label: string;
  status: string;
  detail: string;
}

export interface OnboardingState {
  version: 2;
  completed: boolean;
  doNotPrompt: boolean;
  lastStep: number;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  version: 3;
  exportedAt: string;
  profiles: ProfileDefinition[];
  jobs: JobRow[];
  instructions: BatchInstructions;
  backendUrl: string;
  reports: BatchReport[];
  drafts: MessageDraft[];
  writing: WritingPreferences;
  calendar: CalendarPreferences;
  storage: StorageSettings;
  workflow: WorkflowPreferences;
  dailyQueue?: DailyQueueState;
}

export type UpdateState = "idle" | "checking" | "current" | "available" | "downloading" | "ready_to_restart" | "restarting" | "unsupported" | "error";

export interface ReleaseUpdateStatus {
  state: UpdateState;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseUrl: string;
  publishedAt: string;
  detail: string;
  canInstall: boolean;
  checkedAt: string;
}

export interface WorkspaceResetPreview {
  token: string;
  expiresAt: string;
  counts: Record<string, number>;
  backupPlanned: boolean;
  preserved: string[];
}

export interface WorkspaceResetResult {
  resetAt: string;
  deleted: Record<string, number>;
  backupCreated: boolean;
  backupFile: string;
  preserved: string[];
}
