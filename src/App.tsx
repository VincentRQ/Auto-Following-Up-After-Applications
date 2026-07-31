import {
  AlertTriangle,
  ArrowDownToLine,
  Building2,
  BookOpen,
  ChartNoAxesCombined,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Bug,
  Download,
  FileSpreadsheet,
  FolderSync,
  Filter,
  GripVertical,
  Github,
  HardDriveDownload,
  Inbox,
  Link2,
  Mail,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  SlidersHorizontal,
  Play,
  Plus,
  Radio,
  ShieldAlert,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Terminal,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type {
  AiConnectionSettings,
  AiConnectionCheck,
  AiControlMode,
  BackendHealth,
  BatchInstructions,
  BatchReport,
  BatchSettings,
  CalendarPreferences,
  CrmCompany,
  CrmCompanyDetail,
  DashboardData,
  IntegrationSettings,
  JobRow,
  MailboxEvent,
  MessageDraft,
  PreflightResult,
  ProfileDefinition,
  ProfileKey,
  RunMode,
  SetupStatus,
  OnboardingState,
  SourceFileState,
  StorageSettings,
  RecoveryException,
  WorkflowPreferences,
  WritingPreferences,
  WorkspaceResetPreview,
  WorkspaceSnapshot,
  WorkspaceTutorialState,
} from "./types";
import { formatLocalInputDate, formatRelativeSchedule, isRecent } from "./lib/date";
import { DEFAULT_PROFILES, profileKeyFromLabel, profileLabel } from "./lib/profiles";
import { buildBatchReport, classifyContactQuality } from "./lib/runner";
import { importWorkbook, RECOMMENDED_COLUMNS, REQUIRED_COLUMNS, serializeJobsToCsv } from "./lib/workbook";
import { chooseLinkedSource, forgetLinkedSource, readLinkedSource, rememberLinkedSource, restoreLinkedSource, supportsLinkedFiles, writeLinkedCsv, type LocalFileHandle } from "./lib/sourceFile";
import {
  buildBackendPayload,
  buildPreflight,
  checkExternalStorageAdapter,
  checkBackendHealth,
  checkAiConnection,
  addCrmContact,
  downloadJson,
  downloadText,
  downloadIncidentReport,
  previewWorkspaceReset,
  resetBackendWorkspace,
  fetchDashboard,
  fetchCrmCompanies,
  fetchCrmCompany,
  fetchRecoveryExceptions,
  fetchMailboxEvents,
  fetchSetupStatus,
  generateMessages,
  loadExternalWorkspace,
  saveIntegrationPreferences,
  recordHistoricalOutreach,
  resolveRecoveryException,
  reviewMailboxEvent,
  setCrmCompanySuppression,
  syncMailboxEvents,
  reportToCsv,
  saveExternalWorkspace,
  submitBackendBatch,
  validateHttpEndpoint,
} from "./lib/operations";
import {
  loadAiConnection,
  normalizeAiConnectionSettings,
  normalizeProfileDefinitions,
  loadIntegrationSettings,
  loadInstructions,
  loadJobs,
  loadCalendarPreferences,
  loadMessageDrafts,
  loadProfiles,
  loadOnboardingState,
  loadReports,
  loadStorageSettings,
  loadStoredJobs,
  loadString,
  loadSourceState,
  loadWorkflowPreferences,
  loadWritingPreferences,
  loadWorkspaceTutorialState,
  clearLocalApplicationState,
  saveAiConnection,
  saveJson,
  saveStoredJobs,
  saveString,
  storageKeys,
} from "./lib/storage";
import { buildAdapterPrompt, defaultIntegrationSettings, enrichmentOptions, integrationOption, mailboxOptions, selectIntegration, type IntegrationOption } from "./lib/integrations";
import { defaultStorageSettings, defaultWorkflowPreferences, defaultWritingPreferences, normalizeStorageSettings, normalizeWorkflowPreferences, normalizeWritingPreferences, workflowAttributes } from "./lib/preferences";
import { WritingStudio } from "./components/WritingStudio";
import { CustomizationView } from "./components/CustomizationView";
import { StorageSetup } from "./components/StorageSetup";
import { ApplicationEntryModal, type NewApplicationInput } from "./components/ApplicationEntryModal";
import { WorkspaceTutorial, type TutorialTarget } from "./components/WorkspaceTutorial";
import { buildCalendarEvents, buildCalendarIcs, calendarEventKinds, defaultCalendarPreferences, normalizeCalendarPreferences, selectCalendarEvents, toDateKey, type CalendarEvent } from "./lib/calendar";
import { FALLBACK_BACKEND_URL, resolveDefaultBackendUrl } from "./lib/backend-url";
import { decideSchedule } from "./lib/schedule";

type ImportState = "idle" | "loading" | "ready" | "error";
type WorkspaceTab = "jobs" | "writing" | "source" | "calendar" | "profiles" | "customize";
type ImportIntent = "linked" | "upload" | null;

const APP_VERSION = "0.4.0";
const BUG_ISSUE_URL = "https://github.com/VincentRQ/Auto-Following-Up-After-Applications/issues/new?template=bug_report.yml";
const SUPPORT_EMAIL_URL = "mailto:Vincent@Rosette.Solutions?subject=Outreach%20Console%20help&body=Version%3A%200.4.0%0A%0AWhat%20happened%3A%0A%0ASteps%20to%20reproduce%3A%0A";
const FRESH_START_CONFIRMATION = "START FRESH";
const defaultSchedule = formatLocalInputDate(new Date(Date.now() + 10 * 60_000));
const defaultInstructions: BatchInstructions = {
  emailTemplate:
    "Keep each recruiter follow-up under 80 words including the greeting and sign-off. Use one role-specific detail, one supplied point of fit, the position ID when available, one routing question, the correct job link, and the profile's resume.",
  targetInstructions:
    "Prioritize talent acquisition, recruiter, people operations, and HR contacts. Prefer three contacts per company when clean direct contacts exist.",
  aiInstructions:
    "Write from the candidate's POV. Lead with a factual detail from the listing instead of 'I recently applied.' Keep it warm and direct. Use one question only. Do not invent praise, problems, experience, or metrics, and avoid generic AI or sales phrasing.",
};
const DEFAULT_BACKEND_URL = resolveDefaultBackendUrl({
  configured: import.meta.env.VITE_OUTREACH_BACKEND_URL,
  production: import.meta.env.PROD,
  location: typeof window === "undefined" ? undefined : window.location,
});
const LEGACY_BACKEND_URL = "http://127.0.0.1:8787";
const defaultAiConnection: AiConnectionSettings = { controlMode: "external_operator", mode: "manual", model: "", baseUrl: "", apiKeyEnv: "", strictPlanOnly: false };
const defaultOnboardingState: OnboardingState = { version: 2, completed: false, doNotPrompt: false, lastStep: 0, updatedAt: "" };
const defaultTutorialState: WorkspaceTutorialState = { version: 1, completed: false, skipped: false, lastStep: 0, updatedAt: "" };

type AiConnectionRecipe = { title: string; steps: string[]; command?: string; installCommand?: string; loginCommand?: string; statusCommand?: string; baseUrl?: string; apiKeyEnv?: string; docs?: string; adapter: string; billing?: string; billingSettingsUrl?: string; strictPlanInstruction?: string; modelPlaceholder?: string; planBacked?: boolean; caveat?: string };
const aiConnectionRecipes: Record<AiConnectionSettings["mode"], AiConnectionRecipe> = {
  manual: { title: "Templates only", steps: ["No account or key is required.", "Review and edit the exported run plan outside the app."], adapter: "No AI call is made." },
  codex_cli: { title: "ChatGPT plan via Codex CLI", steps: ["Install Codex CLI.", "Run codex login and choose Sign in with ChatGPT in the browser.", "Run the test below; it must report a ChatGPT-backed login."], installCommand: "npm install -g @openai/codex", loginCommand: "codex login", statusCommand: "codex login status", docs: "https://learn.chatgpt.com/docs/auth", adapter: "Bundled: invokes codex exec with structured output, read-only permissions, and no API-key override.", billing: "The backend accepts only ChatGPT auth, removes OPENAI_API_KEY and CODEX_API_KEY, and uses that account's Codex allowance or ChatGPT credits.", strictPlanInstruction: "Confirm you want usage limited to the allowance and account settings of the signed-in ChatGPT plan.", planBacked: true, modelPlaceholder: "Optional; use the Codex default" },
  claude_cli: { title: "Claude plan via Claude Code", steps: ["Install Claude Code.", "Run claude and sign in with the Claude.ai account that owns Pro, Max, Team, or Enterprise.", "Run the test below; it must report Claude.ai subscription authentication."], installCommand: "npm install -g @anthropic-ai/claude-code@latest", loginCommand: "claude", statusCommand: "claude auth status --json", docs: "https://code.claude.com/docs/en/authentication", adapter: "Bundled: invokes Claude in non-interactive safe mode with tools disabled and validates structured output.", billing: "The backend accepts only Claude.ai subscription auth, strips API/cloud credentials, and uses the plan's noninteractive Agent SDK allowance.", strictPlanInstruction: "Confirm you want usage limited to the allowance and account settings of the signed-in Claude plan.", planBacked: true, modelPlaceholder: "Optional; use the Claude Code default" },
  cursor_cli: { title: "Cursor plan via Cursor CLI", steps: ["Install Cursor CLI in a supported environment.", "Run cursor-agent login and complete the browser login for your Cursor account.", "Disable on-demand usage in the Cursor dashboard, then test the saved account login here."], installCommand: "curl https://cursor.com/install -fsS | bash", loginCommand: "cursor-agent login", statusCommand: "cursor-agent status", docs: "https://docs.cursor.com/en/cli/reference/authentication", adapter: "Bundled where Cursor CLI is available: invokes print mode from an isolated directory with project tools denied.", billing: "The backend uses browser account authentication and removes CURSOR_API_KEY. Cursor account-level on-demand billing is outside the CLI and must be disabled separately.", billingSettingsUrl: "https://cursor.com/dashboard/spending", strictPlanInstruction: "Confirm Cursor on-demand usage is disabled or capped at $0 in the Cursor dashboard.", planBacked: true, modelPlaceholder: "Optional; use the Cursor default", caveat: "Cursor officially supports its CLI on macOS, Linux, and Windows through WSL. A Windows-native backend cannot invoke a CLI installed only inside WSL." },
  opencode_cli: { title: "OpenCode Go plan via OpenCode", steps: ["Install OpenCode.", "Run opencode, enter /connect, select OpenCode Go, and paste the key issued by the Go plan.", "Turn off Use balance in the Zen console, then test that Go and its model list are available."], installCommand: "npm install -g opencode-ai", loginCommand: "opencode", statusCommand: "opencode auth list", docs: "https://opencode.ai/docs/go/", adapter: "Bundled: invokes opencode run with all tools denied and restricts the model to the opencode-go provider.", billing: "OpenCode Go supplies a subscription key rather than browser OAuth. The backend permits only opencode-go models; Zen balance fallback must be disabled separately.", billingSettingsUrl: "https://opencode.ai/zen", strictPlanInstruction: "Confirm Use balance is off in OpenCode Zen so requests stop at the Go plan limit instead of using a Zen balance.", planBacked: true, modelPlaceholder: "Optional opencode-go/<model>; first available Go model is used", caveat: "The console can verify the Go credential and model namespace, but OpenCode does not expose the server-side Use balance switch through this CLI check." },
  ollama: { title: "Ollama local model", steps: ["Install and start Ollama.", "Pull the model entered above.", "Verify the local API responds.", "Install and test the Ollama generation adapter."], command: "ollama pull <model-name>", baseUrl: "http://127.0.0.1:11434/api", docs: "https://docs.ollama.com/api/introduction", adapter: "The local service must call /api/generate or /api/chat. Local access requires no API key." },
  openai_api: { title: "OpenAI API", steps: ["Create a project API key in the OpenAI platform.", "Set OPENAI_API_KEY in the environment that starts the local service.", "Restart the local service, select a model, and test the connection."], baseUrl: "https://api.openai.com/v1", apiKeyEnv: "OPENAI_API_KEY", docs: "https://platform.openai.com/docs/quickstart", adapter: "Requires an OpenAI Responses API adapter. ChatGPT subscription billing is separate from API billing." },
  anthropic_api: { title: "Anthropic API", steps: ["Create an API key in the Anthropic Console.", "Set ANTHROPIC_API_KEY in the environment that starts the local service.", "Restart the local service, select a Claude model, and test the connection."], baseUrl: "https://api.anthropic.com", apiKeyEnv: "ANTHROPIC_API_KEY", docs: "https://docs.anthropic.com/en/api/getting-started", adapter: "Requires an Anthropic Messages API adapter; this is not the OpenAI-compatible request format." },
  gemini_api: { title: "Google Gemini API", steps: ["Create a restricted key in Google AI Studio.", "Set GEMINI_API_KEY in the environment that starts the local service.", "Restart the local service, select a Gemini model, and test the connection."], baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", apiKeyEnv: "GEMINI_API_KEY", docs: "https://ai.google.dev/gemini-api/docs/openai", adapter: "Bundled: uses Gemini's OpenAI-compatible endpoint through the dependency-free API bridge." },
  groq_api: { title: "Groq API", steps: ["Create a Groq API key.", "Set GROQ_API_KEY in the environment that starts the local service.", "Restart the local service, select a supported model, and test the connection."], baseUrl: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", docs: "https://console.groq.com/docs/openai", adapter: "Bundled: uses Groq's OpenAI-compatible endpoint through the dependency-free API bridge." },
  openrouter_api: { title: "OpenRouter API", steps: ["Create an OpenRouter key and optionally give it a spending limit.", "Set OPENROUTER_API_KEY in the environment that starts the local service.", "Restart the local service, enter a provider/model slug, and test the connection."], baseUrl: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY", docs: "https://openrouter.ai/docs/api/reference/authentication", adapter: "Bundled: uses OpenRouter's OpenAI-compatible endpoint and supports its provider/model slugs." },
  deepseek_api: { title: "DeepSeek API", steps: ["Create an API key in the DeepSeek platform.", "Set DEEPSEEK_API_KEY in the environment that starts the local service.", "Restart the local service, enter a current model ID from the official docs, and test the connection."], baseUrl: "https://api.deepseek.com", apiKeyEnv: "DEEPSEEK_API_KEY", docs: "https://api-docs.deepseek.com/api/deepseek-api/", adapter: "Bundled: uses DeepSeek's OpenAI-compatible endpoint. Model names can change, so copy the current ID from the official docs.", modelPlaceholder: "Current DeepSeek model ID" },
  kimi_api: { title: "Kimi API by Moonshot AI", steps: ["Create an API key in the Kimi Open Platform for your region.", "Set MOONSHOT_API_KEY in the environment that starts the local service.", "Restart the local service, enter a current Kimi model ID, and test the connection."], baseUrl: "https://api.moonshot.ai/v1", apiKeyEnv: "MOONSHOT_API_KEY", docs: "https://platform.kimi.ai/docs/api/overview", adapter: "Bundled: uses Kimi's OpenAI-compatible international endpoint. Other regions may require a custom adapter.", modelPlaceholder: "Current Kimi model ID" },
  mistral_api: { title: "Mistral API", steps: ["Create an API key in Mistral Studio.", "Set MISTRAL_API_KEY in the environment that starts the local service.", "Restart the local service, enter a current model ID, and test the connection."], baseUrl: "https://api.mistral.ai/v1", apiKeyEnv: "MISTRAL_API_KEY", docs: "https://docs.mistral.ai/api", adapter: "Bundled: uses Mistral's OpenAI-compatible chat-completions endpoint.", modelPlaceholder: "Current Mistral model ID" },
  together_api: { title: "Together AI API", steps: ["Create a Together AI API key.", "Set TOGETHER_API_KEY in the environment that starts the local service.", "Restart the local service, choose a hosted model ID, and test the connection."], baseUrl: "https://api.together.ai/v1", apiKeyEnv: "TOGETHER_API_KEY", docs: "https://docs.together.ai/docs/inference/openai-compatibility", adapter: "Bundled: uses Together AI's OpenAI-compatible endpoint for hosted open models.", modelPlaceholder: "Together model ID" },
  cerebras_api: { title: "Cerebras Inference API", steps: ["Create a Cerebras Inference API key.", "Set CEREBRAS_API_KEY in the environment that starts the local service.", "Restart the local service, choose a supported model ID, and test the connection."], baseUrl: "https://api.cerebras.ai/v1", apiKeyEnv: "CEREBRAS_API_KEY", docs: "https://inference-docs.cerebras.ai/quickstart", adapter: "Bundled: uses Cerebras's mostly OpenAI-compatible inference endpoint.", modelPlaceholder: "Supported Cerebras model ID" },
  openai_compatible: { title: "Other OpenAI-compatible API", steps: ["Obtain the provider's base URL, model identifier, and API key.", "Store the key in a named environment variable used by the local service.", "Restart the local service and test a minimal request before enabling drafting."], baseUrl: "https://provider.example/v1", apiKeyEnv: "PROVIDER_API_KEY", adapter: "Compatibility varies. The adapter must handle the provider's endpoint and response differences." },
};
const emptySourceState: SourceFileState = {
  mode: "none",
  fileName: "",
  format: "unknown",
  syncState: "idle",
  lastSyncedAt: "",
  lastModified: 0,
  message: "No application file connected.",
};

export function App() {
  const [jobs, setJobs] = useState<JobRow[]>(loadJobs);
  const jobsStorageReady = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<ProfileDefinition[]>(loadProfiles);
  const [profile, setProfile] = useState<ProfileKey>("data_analyst");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("jobs");
  const [newProfileLabel, setNewProfileLabel] = useState("");
  const [newProfileSender, setNewProfileSender] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [rightTab, setRightTab] = useState<"report" | "queue" | "crm" | "mailbox" | "recovery" | "stats" | "setup" | "debug">("report");
  const [workflow, setWorkflow] = useState<WorkflowPreferences>(() => loadWorkflowPreferences(defaultWorkflowPreferences));
  const [storage, setStorage] = useState<StorageSettings>(() => loadStorageSettings(defaultStorageSettings));
  const [writing, setWriting] = useState<WritingPreferences>(() => loadWritingPreferences(defaultWritingPreferences));
  const [drafts, setDrafts] = useState<MessageDraft[]>(loadMessageDrafts);
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule);
  const [spacingSeconds, setSpacingSeconds] = useState(() => loadWorkflowPreferences(defaultWorkflowPreferences).defaultSpacingSeconds);
  const [contactTarget, setContactTarget] = useState(() => loadWorkflowPreferences(defaultWorkflowPreferences).defaultContactTarget);
  const [runMode, setRunMode] = useState<RunMode>("dry_run");
  const [backendUrl, setBackendUrl] = useState(() => {
    const configured = loadString(storageKeys.backendUrl, DEFAULT_BACKEND_URL);
    return safeBackendUrl(configured === LEGACY_BACKEND_URL ? DEFAULT_BACKEND_URL : configured);
  });
  const [aiConnection, setAiConnection] = useState<AiConnectionSettings>(() => loadAiConnection(defaultAiConnection));
  const [aiConnectionCheck, setAiConnectionCheck] = useState<AiConnectionCheck | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSettings>(() => loadIntegrationSettings(defaultIntegrationSettings));
  const [onboarding, setOnboarding] = useState<OnboardingState>(() => loadOnboardingState(defaultOnboardingState));
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const saved = loadOnboardingState(defaultOnboardingState);
    return (saved.version !== 2 || !saved.completed) && !saved.doNotPrompt;
  });
  const [tutorial, setTutorial] = useState<WorkspaceTutorialState>(() => loadWorkspaceTutorialState(defaultTutorialState));
  const [showTutorial, setShowTutorial] = useState(() => {
    const setup = loadOnboardingState(defaultOnboardingState);
    const guide = loadWorkspaceTutorialState(defaultTutorialState);
    return setup.completed && !guide.completed && !guide.skipped;
  });
  const [tutorialTarget, setTutorialTarget] = useState<TutorialTarget | "">("");
  const [showApplicationEntry, setShowApplicationEntry] = useState(false);
  const [showFreshStart, setShowFreshStart] = useState(false);
  const [onboardingEntryStep, setOnboardingEntryStep] = useState(() => loadOnboardingState(defaultOnboardingState).lastStep);
  const [instructions, setInstructions] = useState<BatchInstructions>(() => loadInstructions(defaultInstructions));
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importMeta, setImportMeta] = useState({ fileName: "", sheetName: "", warnings: [] as string[], importedSheets: [] as string[] });
  const [sourceState, setSourceState] = useState<SourceFileState>(() => {
    const saved = loadSourceState(emptySourceState);
    if (saved.mode !== "none" || jobs.length === 0) return saved;
    return { ...emptySourceState, mode: "uploaded", fileName: "Recovered local workspace", syncState: "changed", message: "Rows were restored from local storage. Connect a working file to enable synchronization." };
  });
  const [sourceHandle, setSourceHandle] = useState<LocalFileHandle | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [calendarPreferences, setCalendarPreferences] = useState<CalendarPreferences>(() => loadCalendarPreferences(defaultCalendarPreferences));
  const [importIntent, setImportIntent] = useState<ImportIntent>(null);
  const [report, setReport] = useState<BatchReport | null>(null);
  const [reportHistory, setReportHistory] = useState<BatchReport[]>(loadReports);
  const [backendHealth, setBackendHealth] = useState<BackendHealth>({
    status: "unknown",
    checkedAt: "",
    message: "Not checked.",
    providers: {},
  });
  const [crmCompanies, setCrmCompanies] = useState<CrmCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CrmCompanyDetail | null>(null);
  const [recoveryExceptions, setRecoveryExceptions] = useState<RecoveryException[]>([]);
  const [mailboxEvents, setMailboxEvents] = useState<MailboxEvent[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [backendDataError, setBackendDataError] = useState("");
  const [externalStorageStatus, setExternalStorageStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([
    "Console ready.",
    "Import workbook or use sample rows.",
  ]);
  const [armedSettings, setArmedSettings] = useState<BatchSettings | null>(null);
  const compatibilityInputRef = useRef<HTMLInputElement>(null);
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const configurationInputRef = useRef<HTMLInputElement>(null);
  const lastSerializedRef = useRef("");
  const sourceModifiedRef = useRef(0);
  const externalSyncReadyRef = useRef("");

  const filteredJobs = useMemo(() => {
    const text = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (job.profile !== profile) return false;
      if (statusFilter === "sent" && job.status !== "sent" && !job.sentAt) return false;
      if (statusFilter === "recent" && !isRowRecent(job)) return false;
      if (statusFilter === "active" && (job.status === "sent" || job.sentAt || job.status === "skipped")) return false;
      if (text) {
        const haystack = `${job.company} ${job.roleTitle} ${job.jobId} ${job.source} ${job.notes}`.toLowerCase();
        if (!haystack.includes(text)) return false;
      }
      return true;
    });
  }, [jobs, profile, query, statusFilter]);

  const selectedJobs = useMemo(
    () => jobs.filter((job) => selectedIds.has(job.id) && job.profile === profile),
    [jobs, profile, selectedIds],
  );
  const activeProfile = useMemo(() => profiles.find((item) => item.key === profile) ?? profiles[0], [profiles, profile]);
  const editableJob = selectedJobs[0] ?? null;

  const stats = useMemo(() => {
    const profileJobs = jobs.filter((job) => job.profile === profile);
    return {
      total: profileJobs.length,
      recent: profileJobs.filter(isRowRecent).length,
      sent: profileJobs.filter((job) => job.status === "sent" || job.sentAt).length,
      needsReview: profileJobs.filter((job) => rowNeedsReview(job, contactTarget)).length,
    };
  }, [jobs, profile, contactTarget]);

  const issues = useMemo(() => buildIssues(jobs, profile, contactTarget, importMeta.warnings), [jobs, profile, contactTarget, importMeta.warnings]);
  const batchSettings = useMemo<BatchSettings>(
    () => ({
      profile,
      scheduledAt,
      spacingSeconds,
      contactTarget,
      selectedIds: Array.from(selectedIds),
      instructions,
      mode: runMode,
      backendUrl,
      aiConnection,
    }),
    [profile, scheduledAt, spacingSeconds, contactTarget, selectedIds, instructions, runMode, backendUrl, aiConnection],
  );
  const preflight = useMemo(() => buildPreflight(jobs, batchSettings), [jobs, batchSettings]);

  useEffect(() => {
    if (!armedSettings) return;
    const interval = window.setInterval(() => {
      if (new Date(armedSettings.scheduledAt).getTime() <= Date.now()) {
        void runBatch(armedSettings);
        setArmedSettings(null);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [armedSettings]);

  useEffect(() => {
    saveJson(storageKeys.profiles, profiles);
  }, [profiles]);

  useEffect(() => {
    saveJson(storageKeys.instructions, instructions);
  }, [instructions]);

  useEffect(() => {
    void loadStoredJobs()
      .then((storedJobs) => {
        if (storedJobs.length) setJobs(storedJobs);
        jobsStorageReady.current = true;
      })
      .catch((error) => {
        jobsStorageReady.current = true;
        setConsoleLines((lines) => [...lines, `Workspace storage warning: ${String(error)}`]);
      });
  }, []);

  useEffect(() => {
    if (!jobsStorageReady.current) return;
    void saveStoredJobs(jobs).catch((error) => {
      setConsoleLines((lines) => [...lines, `Unable to save imported rows: ${String(error)}`]);
    });
  }, [jobs]);

  useEffect(() => {
    saveJson(storageKeys.reports, reportHistory);
  }, [reportHistory]);

  useEffect(() => {
    saveString(storageKeys.backendUrl, safeBackendUrl(backendUrl, ""));
  }, [backendUrl]);

  useEffect(() => {
    saveAiConnection(aiConnection);
  }, [aiConnection]);

  useEffect(() => {
    setAiConnectionCheck(null);
  }, [aiConnection.controlMode, aiConnection.mode, aiConnection.baseUrl, aiConnection.apiKeyEnv]);

  useEffect(() => {
    saveJson(storageKeys.integrations, integrations);
  }, [integrations]);

  useEffect(() => {
    saveJson(storageKeys.onboarding, onboarding);
  }, [onboarding]);

  useEffect(() => {
    saveJson(storageKeys.tutorial, tutorial);
  }, [tutorial]);

  useEffect(() => {
    saveJson(storageKeys.sourceState, sourceState);
  }, [sourceState]);

  useEffect(() => {
    saveJson(storageKeys.calendar, calendarPreferences);
  }, [calendarPreferences]);

  useEffect(() => {
    saveJson(storageKeys.workflow, workflow);
  }, [workflow]);

  useEffect(() => {
    saveJson(storageKeys.storage, normalizeStorageSettings(storage));
  }, [storage]);

  useEffect(() => {
    saveJson(storageKeys.writing, writing);
  }, [writing]);

  useEffect(() => {
    saveJson(storageKeys.drafts, drafts);
  }, [drafts]);

  useEffect(() => {
    if (storage.mode === "browser" && runMode === "backend") setRunMode("dry_run");

    if ((workspaceTab === "calendar" && !workflow.modules.calendar) || (workspaceTab === "profiles" && !workflow.modules.profiles)) {
      setWorkspaceTab("jobs");
    }

    const hiddenRightTab =
      (rightTab === "mailbox" && !workflow.modules.mailbox) ||
      (rightTab === "recovery" && !workflow.modules.recovery) ||
      (rightTab === "crm" && !workflow.modules.crm) ||
      (rightTab === "stats" && !workflow.modules.statistics) ||
      (rightTab === "debug" && !workflow.modules.debug);
    if (hiddenRightTab) setRightTab("report");
  }, [rightTab, runMode, storage.mode, workflow.modules, workspaceTab]);

  useEffect(() => {
    if (storage.mode !== "external" || storage.externalSyncMode !== "automatic" || externalSyncReadyRef.current !== externalStorageKey(storage)) return;
    const timer = window.setTimeout(() => {
      void pushExternalWorkspace(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [jobs, profiles, instructions, reportHistory, drafts, writing, workflow, storage]);

  useEffect(() => {
    const mailboxStatus = setupStatus?.providers?.find((item) => item.role === "mailbox")?.status ?? setupStatus?.providerStatus.mailbox;
    if (!backendUrl || mailboxStatus !== "configured") return;
    const interval = window.setInterval(() => void syncMailboxes(), 5 * 60_000);
    return () => window.clearInterval(interval);
  }, [backendUrl, setupStatus]);

  useEffect(() => {
    lastSerializedRef.current = serializeJobsToCsv(jobs);
    sourceModifiedRef.current = sourceState.lastModified;
    if (sourceState.mode !== "linked") return;
    void restoreLinkedSource().then(async (handle) => {
      if (!handle) {
        setSourceState((previous) => ({ ...previous, syncState: "error", message: "The linked file must be reconnected on this browser." }));
        return;
      }
      setSourceHandle(handle);
      try {
        const file = await readLinkedSource(handle);
        sourceModifiedRef.current = file.lastModified;
        setSourceState((previous) => ({ ...previous, lastModified: file.lastModified, message: previous.format === "csv" ? "Linked file restored. App edits auto-save to this CSV." : previous.message }));
      } catch {
        setSourceState((previous) => ({ ...previous, syncState: "error", message: "Reconnect the source file to restore browser permission." }));
      }
    });
  }, []);

  useEffect(() => {
    if (!autoSync || !sourceHandle || sourceState.mode !== "linked" || sourceState.format !== "csv") return;
    const serialized = serializeJobsToCsv(jobs);
    if (!jobs.length || serialized === lastSerializedRef.current || sourceState.syncState === "conflict" || sourceState.syncState === "saving") return;
    if (sourceState.syncState !== "changed") {
      setSourceState((previous) => ({ ...previous, syncState: "changed", message: "Local changes are waiting to sync." }));
      return;
    }
    const timer = window.setTimeout(() => void saveLinkedSource(serialized), 900);
    return () => window.clearTimeout(timer);
  }, [jobs, autoSync, sourceHandle, sourceState.mode, sourceState.format, sourceState.syncState]);

  useEffect(() => {
    if (!sourceHandle || sourceState.mode !== "linked") return;
    const interval = window.setInterval(async () => {
      try {
        const file = await readLinkedSource(sourceHandle);
        if (file.lastModified <= sourceModifiedRef.current) return;
        const dirty = serializeJobsToCsv(jobs) !== lastSerializedRef.current;
        if (dirty) {
          setSourceState((previous) => ({
            ...previous,
            syncState: "conflict",
            message: "The source changed outside the app while local edits were pending. Pull or save explicitly.",
          }));
        } else {
          await pullLinkedSource();
        }
      } catch {
        setSourceState((previous) => ({ ...previous, syncState: "error", message: "The linked file could not be checked." }));
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [sourceHandle, sourceState.mode, jobs]);

  async function handleImport(file: File) {
    setImportState("loading");
    try {
      const result = await importWorkbook(file);
      setJobs(result.rows);
      setSelectedIds(new Set());
      setImportMeta({ fileName: result.fileName, sheetName: result.sheetName, warnings: result.warnings, importedSheets: result.importedSheets });
      setSourceHandle(null);
      void forgetLinkedSource();
      sourceModifiedRef.current = file.lastModified;
      lastSerializedRef.current = serializeJobsToCsv(result.rows);
      setSourceState({
        mode: "uploaded",
        fileName: file.name,
        format: file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
        syncState: "synced",
        lastSyncedAt: new Date().toISOString(),
        lastModified: file.lastModified,
        message: "Imported as a copy. Changes stay in this workspace until you export them.",
      });
      setImportState("ready");
      setWorkspaceTab("jobs");
      pushConsole(`Imported ${result.rows.length} rows from ${result.fileName} / ${result.sheetName}.`);
      if (result.warnings.length) pushConsole(`Warnings: ${result.warnings.join("; ")}.`);
    } catch (error) {
      setImportState("error");
      pushConsole(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}.`);
    }
  }

  async function connectLinkedSource() {
    setImportState("loading");
    try {
      const handle = await chooseLinkedSource();
      const file = await readLinkedSource(handle);
      const result = await importWorkbook(file);
      const format = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
      setJobs(result.rows);
      setSelectedIds(new Set());
      setImportMeta({ fileName: result.fileName, sheetName: result.sheetName, warnings: result.warnings, importedSheets: result.importedSheets });
      setSourceHandle(handle);
      await rememberLinkedSource(handle);
      sourceModifiedRef.current = file.lastModified;
      lastSerializedRef.current = serializeJobsToCsv(result.rows);
      setSourceState({
        mode: "linked",
        fileName: file.name,
        format,
        syncState: "synced",
        lastSyncedAt: new Date().toISOString(),
        lastModified: file.lastModified,
        message: format === "csv" ? "Linked. App edits auto-save to this CSV." : "Linked for change detection. XLSX edits require CSV export.",
      });
      setImportState("ready");
      setWorkspaceTab("jobs");
      pushConsole(`Linked source: ${file.name}.`);
    } catch (error) {
      setImportState("error");
      pushConsole(`Source link failed: ${error instanceof Error ? error.message : "Unknown error"}.`);
    }
  }

  async function saveLinkedSource(serialized = serializeJobsToCsv(jobs)) {
    if (!sourceHandle || sourceState.format !== "csv") return;
    setSourceState((previous) => ({ ...previous, syncState: "saving", message: "Saving to linked CSV..." }));
    try {
      const file = await writeLinkedCsv(sourceHandle, serialized);
      sourceModifiedRef.current = file.lastModified;
      lastSerializedRef.current = serialized;
      setSourceState((previous) => ({
        ...previous,
        syncState: "synced",
        lastSyncedAt: new Date().toISOString(),
        lastModified: file.lastModified,
        message: "Linked CSV is up to date.",
      }));
      pushConsole(`Synced ${jobs.length} rows to ${file.name}.`);
    } catch (error) {
      setSourceState((previous) => ({ ...previous, syncState: "error", message: error instanceof Error ? error.message : "Sync failed." }));
    }
  }

  async function pullLinkedSource() {
    if (!sourceHandle) return;
    try {
      const file = await readLinkedSource(sourceHandle);
      const result = await importWorkbook(file);
      setJobs(result.rows);
      setSelectedIds(new Set());
      setImportMeta({ fileName: result.fileName, sheetName: result.sheetName, warnings: result.warnings, importedSheets: result.importedSheets });
      sourceModifiedRef.current = file.lastModified;
      lastSerializedRef.current = serializeJobsToCsv(result.rows);
      setSourceState((previous) => ({ ...previous, syncState: "synced", lastSyncedAt: new Date().toISOString(), lastModified: file.lastModified, message: "Pulled the latest source file." }));
      pushConsole(`Pulled latest rows from ${file.name}.`);
    } catch (error) {
      setSourceState((previous) => ({ ...previous, syncState: "error", message: error instanceof Error ? error.message : "Pull failed." }));
    }
  }

  function confirmImportIntent() {
    const intent = importIntent;
    setImportIntent(null);
    if (intent === "linked") void connectLinkedSource();
    if (intent === "upload") compatibilityInputRef.current?.click();
  }

  async function loadSampleRows() {
    let currentSetup = setupStatus;
    if (!currentSetup && backendUrl) {
      try {
        currentSetup = await fetchSetupStatus(backendUrl);
        setSetupStatus(currentSetup);
      } catch {
        currentSetup = null;
      }
    }
    const now = new Date().toISOString();
    const sampleProfile: ProfileKey = "customer_success";
    const sample: JobRow[] = [
      sampleJob("sample-1", sampleProfile, "Demo Harbor", "Customer Success Operations Specialist", "https://jobs.example.invalid/customer-success/CS-1042", "CS-1042", "applied", 3, now, "Synthetic sample"),
      sampleJob("sample-2", sampleProfile, "Example Works", "Customer Enablement Coordinator", "https://jobs.example.invalid/enablement/CE-2088", "CE-2088", "sent", 3, now, "Simulated outreach already sent"),
      sampleJob("sample-3", sampleProfile, "Sample Northstar", "Implementation Operations Associate", "https://jobs.example.invalid/implementation/IO-3314", "IO-3314", "applied", 0, now, "Simulated no-contact exception"),
      sampleJob("sample-4", sampleProfile, "Demo Harbor", "Customer Onboarding Specialist", "https://jobs.example.invalid/onboarding/CO-4471", "CO-4471", "interview", 2, now, "Simulated interview event"),
    ];
    setProfiles((current) => current.some((item) => item.key === sampleProfile) ? current : [...current, { key: sampleProfile, label: "Customer Success", senderName: "Sample Candidate", senderEmail: "", resumeLabel: "", notes: "Synthetic public demonstration profile.", accent: "#f0b95e" }]);
    setProfile(sampleProfile);
    setJobs(sample);
    setSelectedIds(new Set(["sample-1", "sample-3"]));
    setImportMeta({ fileName: "sample-applications.csv", sheetName: "Sample", warnings: [], importedSheets: ["Sample"] });
    setSourceHandle(null);
    void forgetLinkedSource();
    lastSerializedRef.current = serializeJobsToCsv(sample);
    const sampleMode = currentSetup?.publicSampleMode === true ? "locked" : currentSetup ? "private" : "unknown";
    const sampleMessage = sampleMode === "locked"
      ? "Synthetic rows loaded under the backend's Public Sample Mode lock."
      : sampleMode === "private"
        ? "Synthetic rows loaded in Private Operator Mode. Provider actions still require their normal gates."
        : "Synthetic rows loaded. The local backend mode could not be verified; no provider was called while loading this sample.";
    setSourceState({ ...emptySourceState, mode: "sample", fileName: "sample-applications.csv", format: "csv", syncState: "synced", lastSyncedAt: now, message: sampleMessage });
    setImportState("ready");
    pushConsole(sampleMode === "locked" ? "Loaded synthetic rows in locked Public Sample Mode." : sampleMode === "private" ? "Loaded synthetic rows in Private Operator Mode." : "Loaded synthetic rows; backend mode is unverified.");
  }

  function addProfile() {
    const label = newProfileLabel.trim();
    if (!label) {
      pushConsole("Profile add blocked: label is required.");
      return;
    }
    const key = profileKeyFromLabel(label);
    if (!key) return;
    if (profiles.some((item) => item.key === key)) {
      pushConsole(`Profile already exists: ${label}.`);
      return;
    }
    const accent = pickAccent(profiles.length);
    const nextProfile = {
      key,
      label,
      senderName: newProfileSender.trim() || label,
      senderEmail: "",
      resumeLabel: "",
      notes: "",
      accent,
    };
    setProfiles((previous) => [...previous, nextProfile]);
    setProfile(key);
    setNewProfileLabel("");
    setNewProfileSender("");
    pushConsole(`Added profile: ${label}.`);
  }

  function updateActiveProfile(update: Partial<ProfileDefinition>) {
    setProfiles((previous) => previous.map((item) => (item.key === profile ? { ...item, ...update } : item)));
  }

  function deleteActiveProfile() {
    if (profiles.length <= 1) {
      pushConsole("Profile delete blocked: at least one profile is required.");
      return;
    }
    const removed = profiles.find((item) => item.key === profile);
    const remaining = profiles.filter((item) => item.key !== profile);
    setProfiles(remaining);
    setSelectedIds(new Set());
    setProfile(remaining[0].key);
    pushConsole(`Deleted profile: ${removed?.label ?? profile}.`);
  }

  function toggleJob(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const job of filteredJobs) {
        if (job.status !== "sent" && !job.sentAt) next.add(job.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function selectReadyOnly() {
    const readyIds = preflight.queue.filter((item) => item.status === "ready").map((item) => item.id);
    setSelectedIds(new Set(readyIds));
    pushConsole(`Selected ${readyIds.length} ready queue rows.`);
  }

  function updateJob(jobId: string, update: Partial<JobRow>) {
    setJobs((previous) => previous.map((job) => {
      if (job.id !== jobId) return job;
      const nextProfile = update.profile ?? job.profile;
      return { ...job, ...update, profileLabel: profileLabel(nextProfile, profiles), lastWorkedAt: new Date().toISOString() };
    }));
    markApplicationDataChanged("Application edits are saved in this workspace.");
  }

  function addApplication(value: NewApplicationInput) {
    const now = new Date().toISOString();
    const id = `manual-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
    const job: JobRow = {
      id,
      originalRow: jobs.reduce((maximum, item) => Math.max(maximum, item.originalRow), 1) + 1,
      profile: value.profile,
      profileLabel: profileLabel(value.profile, profiles),
      company: value.company,
      roleTitle: value.roleTitle,
      jobDescription: value.jobDescription,
      jobUrl: value.jobUrl,
      jobId: value.jobId || inferJobId(value.jobUrl),
      source: value.source,
      status: value.status,
      appliedAt: value.appliedDate ? `${value.appliedDate}T12:00:00.000Z` : now,
      lastWorkedAt: now,
      sentAt: "",
      contactsFound: null,
      notes: value.notes,
      importedAt: now,
    };
    setJobs((previous) => [...previous, job]);
    setProfile(value.profile);
    setSelectedIds(new Set([id]));
    setStatusFilter("all");
    setWorkspaceTab("jobs");
    setShowApplicationEntry(false);
    markApplicationDataChanged("New applications entered here are saved locally. Export a CSV any time, or link a CSV for automatic write-back.");
    pushConsole(`Added ${job.roleTitle} at ${job.company}.`);
  }

  function deleteJob(job: JobRow) {
    if (!window.confirm(`Remove ${job.roleTitle || "this application"} at ${job.company || "this company"} from the workspace?`)) return;
    setJobs((previous) => previous.filter((item) => item.id !== job.id));
    setDrafts((previous) => previous.filter((draft) => draft.jobRowId !== job.id));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(job.id);
      return next;
    });
    markApplicationDataChanged("The application was removed from this workspace.");
    pushConsole(`Removed ${job.roleTitle || "application"} at ${job.company || "unknown company"}.`);
  }

  function markApplicationDataChanged(message: string) {
    setSourceState((previous) => {
      if (previous.mode === "linked") {
        return { ...previous, syncState: "changed", message: previous.format === "csv" ? "Local edits are waiting to sync to the linked CSV." : "Local edits are saved. Export a managed CSV to carry them back to the working file." };
      }
      if (previous.mode === "uploaded") return { ...previous, syncState: "changed", message };
      return { mode: "manual", fileName: "In-app application list", format: "unknown", syncState: "changed", lastSyncedAt: "", lastModified: 0, message };
    });
  }

  function armOrRun() {
    const settings = batchSettings;
    if (storage.mode === "browser" && settings.mode === "backend") {
      pushConsole("Launch blocked: browser-only storage supports local dry runs. Select SQLite or an existing database before backend submission.");
      setRunMode("dry_run");
      return;
    }
    if (!settings.selectedIds.length) {
      pushConsole("Launch blocked: no jobs selected.");
      return;
    }
    const currentPreflight = buildPreflight(jobs, settings);
    if (currentPreflight.readyCount === 0) {
      pushConsole("Launch blocked: no ready jobs after preflight.");
      setRightTab("debug");
      return;
    }
    const scheduleDecision = decideSchedule(settings.scheduledAt);
    if (scheduleDecision === "invalid") {
      pushConsole("Launch blocked: choose a valid start date and time.");
      return;
    }
    if (scheduleDecision === "run_now") {
      setArmedSettings(null);
      void runBatch(settings);
      return;
    }
    setArmedSettings(settings);
    pushConsole(`Batch armed for ${settings.scheduledAt}.`);
  }

  async function runBatch(settings: BatchSettings) {
    setIsRunning(true);
    let nextReport = buildBatchReport(jobs, settings);
    if (settings.mode === "backend") {
      try {
        const message = await submitBackendBatch(jobs, settings);
        nextReport = { ...nextReport, backendStatus: "submitted", backendMessage: message };
      } catch (error) {
        nextReport = {
          ...nextReport,
          backendStatus: "failed",
          backendMessage: error instanceof Error ? error.message : "Backend submission failed.",
        };
      }
    }
    setReport(nextReport);
    setReportHistory((previous) => [nextReport, ...previous].slice(0, 20));
    setJobs((previous) =>
      previous.map((job) => {
        const item = nextReport.items.find((candidate) => candidate.jobId === job.jobId && candidate.company === job.company);
        if (!item || item.outcome !== "prepared") return job;
        return { ...job, status: settings.mode === "backend" && nextReport.backendStatus === "submitted" ? "queued" : "drafted" };
      }),
    );
    pushConsole(`Run ${nextReport.runId} launched: ${nextReport.prepared} prepared, ${nextReport.skipped} skipped, ${nextReport.cleanContactGaps} contact flags.`);
    if (settings.instructions.aiInstructions.trim()) pushConsole("Batch instructions attached to report.");
    if (nextReport.backendStatus === "failed") pushConsole(`Backend failed: ${nextReport.backendMessage}`);
    if (nextReport.backendStatus === "submitted") pushConsole("Batch submitted to backend.");
    setIsRunning(false);
  }

  function clearWorkspace() {
    setJobs([]);
    setDrafts([]);
    setSelectedIds(new Set());
    setReport(null);
    setReportHistory([]);
    setImportMeta({ fileName: "", sheetName: "", warnings: [], importedSheets: [] });
    setSourceHandle(null);
    void forgetLinkedSource();
    lastSerializedRef.current = "";
    sourceModifiedRef.current = 0;
    setSourceState(emptySourceState);
    pushConsole("Workspace cleared.");
  }

  function exportWorkspace() {
    downloadJson("outreach-console-workspace.json", buildWorkspaceSnapshot());
    pushConsole("Workspace export prepared.");
  }

  function buildWorkspaceSnapshot(): WorkspaceSnapshot {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      profiles,
      jobs,
      instructions,
      backendUrl: safeBackendUrl(backendUrl),
      reports: reportHistory,
      drafts,
      writing,
      calendar: calendarPreferences,
      storage: normalizeStorageSettings(storage),
      workflow,
    };
  }

  async function startFresh(clearBackend: boolean, token: string, confirmation: string) {
    const createdAt = new Date().toISOString();
    downloadJson(`outreach-console-before-reset-${createdAt.replace(/[:.]/g, "-")}.json`, {
      type: "outreach-console-fresh-start-backup",
      version: 1,
      createdAt,
      workspace: buildWorkspaceSnapshot(),
      configuration: { workflow, storage: normalizeStorageSettings(storage), writing, calendar: calendarPreferences, aiConnection, integrations },
      source: sourceState,
    });
    if (clearBackend) await resetBackendWorkspace(backendUrl, token, confirmation);
    await forgetLinkedSource();
    await clearLocalApplicationState();
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    window.location.reload();
  }

  async function importWorkspace(file: File) {
    try {
      const snapshot = JSON.parse(await file.text()) as Partial<WorkspaceSnapshot> & { version?: number };
      if (![1, 2].includes(snapshot.version ?? 0) || !Array.isArray(snapshot.jobs) || !Array.isArray(snapshot.profiles)) {
        throw new Error("Workspace file is not valid.");
      }
      applyWorkspaceSnapshot(snapshot);
      setImportMeta({ fileName: file.name, sheetName: "Workspace", warnings: [], importedSheets: ["Workspace"] });
      setSourceHandle(null);
      void forgetLinkedSource();
      lastSerializedRef.current = serializeJobsToCsv(snapshot.jobs);
      setSourceState({ ...emptySourceState, mode: "uploaded", fileName: file.name, syncState: "synced", lastSyncedAt: new Date().toISOString(), message: "Workspace snapshot imported. It is not linked to an application spreadsheet." });
      pushConsole(`Workspace imported: ${snapshot.jobs.length} rows.`);
    } catch (error) {
      pushConsole(`Workspace import failed: ${error instanceof Error ? error.message : "Unknown error"}.`);
    }
  }

  function applyWorkspaceSnapshot(snapshot: Partial<WorkspaceSnapshot>) {
    const nextProfiles = normalizeProfileDefinitions(snapshot.profiles, DEFAULT_PROFILES);
    const nextJobs = Array.isArray(snapshot.jobs) ? snapshot.jobs : [];
    const nextReports = Array.isArray(snapshot.reports) ? snapshot.reports : [];
    setProfiles(nextProfiles);
    setJobs(nextJobs);
    setInstructions({ ...defaultInstructions, ...snapshot.instructions });
    setBackendUrl(safeBackendUrl(snapshot.backendUrl ?? backendUrl));
    setReportHistory(nextReports);
    setReport(nextReports[0] ?? null);
    setDrafts(Array.isArray(snapshot.drafts) ? snapshot.drafts : []);
    setWriting(normalizeWritingPreferences(snapshot.writing));
    setCalendarPreferences(normalizeCalendarPreferences(snapshot.calendar));
    setStorage(normalizeStorageSettings(snapshot.storage ?? storage));
    setWorkflow(normalizeWorkflowPreferences(snapshot.workflow));
    setSelectedIds(new Set());
    setProfile(nextProfiles[0].key);
  }

  function exportConfiguration() {
    downloadJson("outreach-console-configuration.json", {
      version: 1,
      exportedAt: new Date().toISOString(),
      workflow,
      storage: normalizeStorageSettings(storage),
      writing,
      calendar: calendarPreferences,
      aiConnection,
      integrations,
    });
    pushConsole("Non-secret configuration export prepared.");
  }

  async function importConfiguration(file: File) {
    try {
      const value = JSON.parse(await file.text()) as {
        version?: number;
        workflow?: Partial<WorkflowPreferences>;
        storage?: Partial<StorageSettings>;
        writing?: Partial<WritingPreferences>;
        calendar?: Partial<CalendarPreferences>;
        aiConnection?: Partial<AiConnectionSettings>;
        integrations?: IntegrationSettings;
      };
      if (value.version !== 1 || !value.workflow || !value.storage || !value.writing) throw new Error("Configuration file is missing required sections.");
      setWorkflow(normalizeWorkflowPreferences(value.workflow));
      setStorage(normalizeStorageSettings(value.storage));
      setWriting(normalizeWritingPreferences(value.writing));
      setCalendarPreferences(normalizeCalendarPreferences(value.calendar));
      if (value.aiConnection) setAiConnection(normalizeAiConnectionSettings(value.aiConnection, defaultAiConnection));
      if (value.integrations) setIntegrations({ ...defaultIntegrationSettings, ...value.integrations });
      pushConsole("Configuration imported. Credentials were not read or stored.");
    } catch (error) {
      pushConsole(`Configuration import failed: ${error instanceof Error ? error.message : "Unknown error"}.`);
    }
  }

  function resetCustomization() {
    setWorkflow(defaultWorkflowPreferences);
    setCalendarPreferences(defaultCalendarPreferences);
    setSpacingSeconds(defaultWorkflowPreferences.defaultSpacingSeconds);
    setContactTarget(defaultWorkflowPreferences.defaultContactTarget);
    pushConsole("Interface and workflow preferences reset to public defaults.");
  }

  async function generateDraftMessages(brief: string, selectedDrafts: MessageDraft[]) {
    if (storage.mode === "browser") throw new Error("In-app AI generation needs a configured local backend. Use Outside AI or Manual in browser-only mode.");
    return generateMessages(backendUrl, { brief, drafts: selectedDrafts, maximum_words: writing.maximumWords, ai_connection: aiConnection });
  }

  async function testExternalStorage() {
    setExternalStorageStatus("Testing database adapter...");
    try {
      const result = await checkExternalStorageAdapter(storage.externalAdapterUrl);
      setExternalStorageStatus(`${result.status === "ok" && result.schemaReady ? "Ready" : "Needs setup"}: ${result.detail}`);
    } catch (error) {
      setExternalStorageStatus(error instanceof Error ? error.message : "Database adapter test failed.");
    }
  }

  async function pushExternalWorkspace(showMessage = true) {
    if (storage.mode !== "external") return;
    try {
      const result = await checkExternalStorageAdapter(storage.externalAdapterUrl);
      if (result.status !== "ok" || !result.schemaReady) throw new Error(result.detail);
      await saveExternalWorkspace(storage.externalAdapterUrl, storage.externalWorkspaceId, buildWorkspaceSnapshot());
      externalSyncReadyRef.current = externalStorageKey(storage);
      setExternalStorageStatus(`Workspace ${storage.externalWorkspaceId} synchronized at ${new Date().toLocaleTimeString()}.`);
      if (showMessage) pushConsole("Current workspace pushed to the external database adapter.");
    } catch (error) {
      externalSyncReadyRef.current = "";
      const message = error instanceof Error ? error.message : "External database push failed.";
      setExternalStorageStatus(message);
      if (showMessage) pushConsole(`External database push failed: ${message}`);
    }
  }

  async function pullExternalWorkspace() {
    if (storage.mode !== "external") return;
    exportWorkspace();
    setExternalStorageStatus("Loading external workspace...");
    try {
      const result = await checkExternalStorageAdapter(storage.externalAdapterUrl);
      if (result.status !== "ok" || !result.schemaReady) throw new Error(result.detail);
      const snapshot = await loadExternalWorkspace(storage.externalAdapterUrl, storage.externalWorkspaceId);
      if (!snapshot) {
        setExternalStorageStatus("No external workspace exists yet. Push the current workspace to create it.");
        return;
      }
      if (snapshot.version !== 2 || !Array.isArray(snapshot.jobs) || !Array.isArray(snapshot.profiles)) throw new Error("The adapter returned an incompatible workspace.");
      applyWorkspaceSnapshot({ ...snapshot, storage });
      externalSyncReadyRef.current = externalStorageKey(storage);
      setExternalStorageStatus(`External workspace loaded. A local JSON backup was downloaded first.`);
      pushConsole(`Pulled external workspace ${storage.externalWorkspaceId}: ${snapshot.jobs.length} rows.`);
    } catch (error) {
      externalSyncReadyRef.current = "";
      const message = error instanceof Error ? error.message : "External database pull failed.";
      setExternalStorageStatus(message);
      pushConsole(`External database pull failed: ${message}`);
    }
  }

  async function runHealthCheck() {
    const result = await checkBackendHealth(backendUrl);
    setBackendHealth(result);
    pushConsole(`Backend health: ${result.status} - ${result.message}`);
  }

  async function runAiConnectionCheck() {
    const checking: AiConnectionCheck = { mode: aiConnection.mode, label: aiConnectionRecipes[aiConnection.mode].title, status: "checking", installed: false, authenticated: false, detail: "Checking the local CLI and its saved login without making a model request...", nextCommand: "", version: "", availableModels: [] };
    setAiConnectionCheck(checking);
    try {
      const result = await checkAiConnection(backendUrl, aiConnection);
      setAiConnectionCheck(result);
      pushConsole(`AI connection: ${result.status} - ${result.detail}`);
      return result;
    } catch (error) {
      const failed: AiConnectionCheck = { ...checking, status: "error", detail: error instanceof Error ? error.message : "AI connection check failed." };
      setAiConnectionCheck(failed);
      pushConsole(`AI connection check failed: ${failed.detail}`);
      return failed;
    }
  }

  async function refreshBackendData() {
    const requests = await Promise.allSettled([
      fetchCrmCompanies(backendUrl), fetchRecoveryExceptions(backendUrl), fetchMailboxEvents(backendUrl),
      fetchDashboard(backendUrl), fetchSetupStatus(backendUrl), selectedCompany ? fetchCrmCompany(backendUrl, selectedCompany.id) : Promise.resolve(null),
    ] as const);
    if (requests[0].status === "fulfilled") setCrmCompanies(requests[0].value);
    if (requests[1].status === "fulfilled") setRecoveryExceptions(requests[1].value);
    if (requests[2].status === "fulfilled") setMailboxEvents(requests[2].value);
    if (requests[3].status === "fulfilled") setDashboard(requests[3].value);
    if (requests[4].status === "fulfilled") setSetupStatus(requests[4].value);
    if (requests[5].status === "fulfilled" && requests[5].value) setSelectedCompany(requests[5].value);
    const failed = requests.map((result, index) => result.status === "rejected" ? `${["contacts", "recovery", "mailbox", "statistics", "setup", "company detail"][index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}` : "").filter(Boolean);
    setBackendDataError(failed.join(" / "));
    if (failed.length) pushConsole(`Partial refresh: ${failed.join("; ")}. Healthy panels kept their previous data.`);
    else pushConsole(`Backend data refreshed: ${requests[0].status === "fulfilled" ? requests[0].value.length : crmCompanies.length} companies.`);
  }

  async function completeOnboarding(next: IntegrationSettings) {
    setIntegrations(next);
    if (aiConnection.controlMode === "in_app" && storage.mode === "browser") throw new Error("Console-managed AI needs the local backend. Choose Embedded SQLite for the lightweight local setup, or use Outside AI with browser-only storage.");
    if (aiConnection.controlMode === "in_app") {
      const checked = aiConnectionCheck?.mode === aiConnection.mode && aiConnectionCheck.status === "ready" ? aiConnectionCheck : await runAiConnectionCheck();
      if (checked.status !== "ready") throw new Error(`Finish the AI plan connection first: ${checked.detail}`);
      if (aiConnectionRecipes[aiConnection.mode].planBacked && !aiConnection.strictPlanOnly) throw new Error("Confirm the strict plan-only billing guard before finishing setup.");
    }
    if (storage.mode === "external") {
      if (!storage.externalAdapterUrl || !storage.externalSchemaReady) throw new Error("Enter the external database adapter URL and confirm its schema before finishing setup.");
      const external = await checkExternalStorageAdapter(storage.externalAdapterUrl);
      if (external.status !== "ok" || !external.schemaReady) throw new Error(`External database adapter is not ready: ${external.detail}`);
    }
    if (storage.mode !== "browser") {
      const saved = await saveIntegrationPreferences(backendUrl, next);
      const [health, setup] = await Promise.all([checkBackendHealth(backendUrl), fetchSetupStatus(backendUrl)]);
      setBackendHealth(health);
      setSetupStatus(setup);
      if (health.status !== "ok") throw new Error(`The local service is not ready at ${backendUrl}. Test the address before finishing setup.`);
      if (aiConnection.controlMode !== "external_operator") {
        const providerBlockers = (saved.providers ?? setup.providers ?? []).filter((item) => !["configured", "disabled"].includes(item.status));
        if (providerBlockers.length) throw new Error(`Finish the local adapters first: ${providerBlockers.map((item) => item.label).join(", ")}.`);
        if (!setup.profiles.length || setup.profiles.some((item) => !item.account || !item.resumeConfigured)) throw new Error("Each local profile needs a sender account and resume before in-app operation is ready.");
      }
    } else {
      setRunMode("dry_run");
      setBackendHealth({ status: "unknown", checkedAt: new Date().toISOString(), message: "Browser-only mode does not require the local service.", providers: {} });
    }
    const completed: OnboardingState = { ...onboarding, version: 2, completed: true, doNotPrompt: false, lastStep: 4, updatedAt: new Date().toISOString() };
    setOnboarding(completed);
    setShowOnboarding(false);
    setTutorial({ ...defaultTutorialState, updatedAt: new Date().toISOString() });
    setShowTutorial(true);
    if (storage.mode !== "browser") {
      await runHealthCheck();
      await refreshBackendData();
    }
  }

  function closeOnboarding(step: number, doNotPrompt: boolean, draft: IntegrationSettings) {
    setIntegrations(draft);
    setOnboarding((previous) => ({ ...previous, version: 2, doNotPrompt, lastStep: step, updatedAt: new Date().toISOString() }));
    setShowOnboarding(false);
  }

  function manageProfilesFromOnboarding(step: number, doNotPrompt: boolean, draft: IntegrationSettings) {
    closeOnboarding(step, doNotPrompt, draft);
    setWorkspaceTab("profiles");
  }

  async function selectCrmCompany(companyId: number) {
    try {
      setSelectedCompany(await fetchCrmCompany(backendUrl, companyId));
      setBackendDataError("");
    } catch (error) {
      setBackendDataError(error instanceof Error ? error.message : "Unable to load company.");
    }
  }

  async function saveCrmContact(contact: { name: string; title: string; email: string; source: string; tier: number; confidence: number }) {
    if (!selectedCompany) return;
    await addCrmContact(backendUrl, selectedCompany.id, contact);
    await refreshBackendData();
  }

  async function saveHistoricalOutreach(entry: { contact_id: number | null; job_id: number | null; profile: string; status: string; subject: string; occurred_at: string }) {
    if (!selectedCompany) return;
    await recordHistoricalOutreach(backendUrl, selectedCompany.id, entry);
    await refreshBackendData();
  }

  async function toggleCompanySuppression() {
    if (!selectedCompany) return;
    await setCrmCompanySuppression(backendUrl, selectedCompany.id, !selectedCompany.suppression_reason);
    await refreshBackendData();
  }

  async function resolveException(id: number, resolution: "completed" | "dismissed" | "deferred") {
    await resolveRecoveryException(backendUrl, id, resolution);
    await refreshBackendData();
  }

  async function syncMailboxes() {
    try {
      const result = await syncMailboxEvents(backendUrl);
      pushConsole(`Mailbox sync: ${result.scanned} scanned, ${result.inserted} new, ${result.matched} matched, ${result.unmatched} review.`);
      if (result.errors?.length) pushConsole(`Mailbox sync degraded: ${result.errors.map((item) => `${item.account}: ${item.message}`).join("; ")}. Other accounts continued.`);
      await refreshBackendData();
    } catch (error) {
      pushConsole(`Mailbox sync failed: ${error instanceof Error ? error.message : "Unknown error"}.`);
    }
  }

  async function dismissMailboxEvent(id: number) {
    await reviewMailboxEvent(backendUrl, id, { dismissed: true });
    await refreshBackendData();
  }

  function pushConsole(line: string) {
    setConsoleLines((previous) => [line, ...previous].slice(0, 12));
  }

  function openOnboarding(step: number) {
    setOnboardingEntryStep(step);
    setShowOnboarding(true);
  }

  function openTutorial() {
    setTutorialTarget("");
    setShowTutorial(true);
  }

  function navigateTutorial(target: TutorialTarget) {
    setTutorialTarget(target);
    if (target === "source") setWorkspaceTab("source");
    if (target === "tabs") setWorkspaceTab(workflow.modules.profiles ? "profiles" : "jobs");
    if (["jobs", "left", "right", "mailbox"].includes(target)) setWorkspaceTab("jobs");
    if (target === "writing") setWorkspaceTab("writing");
    if (target === "calendar") setWorkspaceTab(workflow.modules.calendar ? "calendar" : "customize");
    if (target === "customize") setWorkspaceTab("customize");
    if (target === "right") setRightTab("queue");
    if (target === "mailbox") setRightTab(workflow.modules.mailbox ? "mailbox" : workflow.modules.recovery ? "recovery" : "report");
    window.requestAnimationFrame(() => document.querySelector(`[data-tutorial-region="${target}"]`)?.scrollIntoView({ behavior: workflow.reduceMotion ? "auto" : "smooth", block: "nearest" }));
  }

  function recordTutorialStep(step: number) {
    setTutorial((previous) => previous.lastStep === step ? previous : { ...previous, lastStep: step, updatedAt: new Date().toISOString() });
  }

  function skipTutorial() {
    setTutorial((previous) => ({ ...previous, skipped: true, completed: false, updatedAt: new Date().toISOString() }));
    setShowTutorial(false);
    setTutorialTarget("");
  }

  function completeTutorial() {
    setTutorial((previous) => ({ ...previous, completed: true, skipped: false, updatedAt: new Date().toISOString() }));
    setShowTutorial(false);
    setTutorialTarget("");
  }

  function resizePanel(panel: "left" | "right", delta: number) {
    setWorkflow((previous) => normalizeWorkflowPreferences({
      ...previous,
      [panel === "left" ? "leftPanelWidth" : "rightPanelWidth"]: previous[panel === "left" ? "leftPanelWidth" : "rightPanelWidth"] + delta,
    }));
  }

  function beginPanelResize(panel: "left" | "right", event: ReactPointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(max-width: 1180px)").matches) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panel === "left" ? workflow.leftPanelWidth : workflow.rightPanelWidth;
    document.body.classList.add("resizing-panels");
    const move = (pointerEvent: PointerEvent) => {
      const delta = pointerEvent.clientX - startX;
      setWorkflow((previous) => normalizeWorkflowPreferences({ ...previous, [panel === "left" ? "leftPanelWidth" : "rightPanelWidth"]: startWidth + (panel === "left" ? delta : -delta) }));
    };
    const stop = () => {
      document.body.classList.remove("resizing-panels");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  function resetPanelSizes() {
    setWorkflow((previous) => ({ ...previous, leftPanelWidth: defaultWorkflowPreferences.leftPanelWidth, rightPanelWidth: defaultWorkflowPreferences.rightPanelWidth }));
    pushConsole("Panel sizes reset.");
  }

  const integrationNeedsAttention = setupStatus?.providers?.some((item) => !["configured", "disabled"].includes(item.status)) ?? false;
  const systemState = storage.mode === "browser" && onboarding.completed
    ? { state: "ready", label: "Browser mode ready" }
    : backendHealth.status === "error"
    ? { state: "error", label: "Local service offline" }
    : backendHealth.status !== "ok" || !onboarding.completed || integrationNeedsAttention ? { state: "setup", label: "Setup needs attention" }
      : { state: "ready", label: "Core services ready" };

  return (
    <main className="shell" {...workflowAttributes(workflow)}>
      <section className="topbar" data-tutorial-region="top" data-tutorial-active={tutorialTarget === "top" ? "true" : undefined}>
        <div className="brand">
          <span className="brand-mark"><Terminal size={22} /></span>
          <div>
            <h1>Outreach Console</h1>
            <p>local batch operator</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="wizard-chip" onClick={() => openOnboarding(0)} title="Open initial setup">
            <Settings size={16} />
            <span>Setup wizard</span>
          </button>
          <button className="wizard-chip guide-chip" onClick={openTutorial} title="Open the step-by-step operating guide">
            <BookOpen size={16} />
            <span>Guide</span>
          </button>
          <a className="wizard-chip feedback-chip" href={BUG_ISSUE_URL} target="_blank" rel="noreferrer" title="Open a structured GitHub bug ticket">
            <Bug size={16} />
            <span>Share a bug</span>
          </a>
          <button className={`system-chip ${systemState.state}`} onClick={() => { setWorkspaceTab("jobs"); setRightTab("setup"); void runHealthCheck(); void refreshBackendData(); }}>
            <Radio size={16} />
            <span>{systemState.label}</span>
          </button>
          <div className="run-chip">
            <CalendarClock size={16} />
            <span>{armedSettings ? `armed ${formatRelativeSchedule(armedSettings.scheduledAt)}` : "no batch armed"}</span>
          </div>
          <div className="run-chip">
            <HardDriveDownload size={16} />
            <span>{storage.mode === "browser" ? "browser storage" : storage.mode === "sqlite" ? "SQLite history" : "external database"}</span>
          </div>
        </div>
      </section>

      {!onboarding.completed && <section className="setup-reminder"><AlertTriangle size={16} /><div><strong>Initial setup is not finished</strong><span>Your saved work is intact. Resume at step {onboarding.lastStep + 1} when ready.</span></div><button className="small-button compact" onClick={() => openOnboarding(onboarding.lastStep)}>Resume setup</button></section>}

      <nav className="workspace-tabs" aria-label="Workspace views" data-tutorial-region="tabs" data-tutorial-active={tutorialTarget === "tabs" ? "true" : undefined}>
        <button className={workspaceTab === "jobs" ? "active" : ""} onClick={() => setWorkspaceTab("jobs")}><FileSpreadsheet size={16} /> Jobs</button>
        <button className={workspaceTab === "writing" ? "active" : ""} onClick={() => setWorkspaceTab("writing")}><Sparkles size={16} /> Writing</button>
        <button className={workspaceTab === "source" ? "active" : ""} onClick={() => setWorkspaceTab("source")}><FolderSync size={16} /> Data Source</button>
        {workflow.modules.calendar && <button className={workspaceTab === "calendar" ? "active" : ""} onClick={() => setWorkspaceTab("calendar")}><CalendarDays size={16} /> Calendar</button>}
        {workflow.modules.profiles && <button className={workspaceTab === "profiles" ? "active" : ""} onClick={() => setWorkspaceTab("profiles")}><Users size={16} /> Profiles</button>}
        <button className={workspaceTab === "customize" ? "active" : ""} onClick={() => setWorkspaceTab("customize")}><SlidersHorizontal size={16} /> Customize</button>
      </nav>

      <section className="layout" style={{ "--left-panel-width": `${workflow.leftPanelWidth}px`, "--right-panel-width": `${workflow.rightPanelWidth}px` } as CSSProperties}>
        <aside className="side-panel" data-tutorial-region="left" data-tutorial-active={tutorialTarget === "left" ? "true" : undefined}>
          <PanelTitle icon={<FolderSync size={16} />} label="Data Source" />
          <button className={`source-summary ${sourceState.syncState}`} onClick={() => setWorkspaceTab("source")}>
            <span>{sourceState.fileName || "No file connected"}</span>
            <strong>{sourceState.mode === "linked" ? `linked / ${sourceState.syncState}` : sourceState.mode}</strong>
            <small>{jobs.length} rows</small>
          </button>

          <PanelTitle icon={<Filter size={16} />} label="Sending Profile" />
          <label className="field">
            <span>Profile for this batch</span>
            <select name="batch-profile" value={profile} onChange={(event) => setProfile(event.target.value)}>
              {profiles.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <button className="ghost-button" onClick={() => setWorkspaceTab("profiles")}><Settings size={16} /> Manage profiles</button>

          <PanelTitle icon={<CalendarClock size={16} />} label="Launch" />
          <label className="field">
            <span>Start</span>
            <input name="scheduled-at" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </label>
          <label className="field">
            <span>Spacing between emails (seconds)</span>
            <input
              name="spacing-seconds"
              type="number"
              min="15"
              max="300"
              value={spacingSeconds}
              onChange={(event) => setSpacingSeconds(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Contact target</span>
            <input
              name="contact-target"
              type="number"
              min="1"
              max="8"
              value={contactTarget}
              onChange={(event) => setContactTarget(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Run mode</span>
            <select name="run-mode" value={runMode} onChange={(event) => setRunMode(event.target.value as RunMode)}>
              <option value="dry_run">dry run</option>
              <option value="backend" disabled={storage.mode === "browser"}>backend submit (requires durable storage)</option>
            </select>
          </label>
          <label className="field">
            <span>Backend URL</span>
            <input name="backend-url" value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} placeholder={DEFAULT_BACKEND_URL} />
          </label>
          <button className="ghost-button" onClick={() => void runHealthCheck()}>
            <Radio size={16} />
            Check backend
          </button>
          <button className="launch-button" onClick={armOrRun} disabled={isRunning}>
            <Play size={17} />
            {isRunning ? "Running" : "Launch"}
          </button>
        </aside>

        <div className="panel-resizer" role="separator" aria-label="Resize left column" aria-orientation="vertical" aria-valuemin={220} aria-valuemax={440} aria-valuenow={workflow.leftPanelWidth} tabIndex={0} onPointerDown={(event) => beginPanelResize("left", event)} onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          resizePanel("left", event.key === "ArrowLeft" ? -10 : 10);
        }}><GripVertical size={16} /></div>

        <section className="main-panel">
          <div hidden={workspaceTab !== "jobs"} data-tutorial-region="jobs" data-tutorial-active={tutorialTarget === "jobs" ? "true" : undefined}>
          <div className="metrics-grid">
            <Metric label="Profile" value={profileLabel(profile, profiles)} />
            <Metric label="Rows" value={stats.total.toString()} />
            <Metric label="Recent" value={stats.recent.toString()} />
            <Metric label="Sent" value={stats.sent.toString()} />
            <Metric label="Review" value={stats.needsReview.toString()} />
            <Metric label="Selected" value={selectedJobs.length.toString()} />
          </div>

          <div className="instructions-panel">
            <label>
              <span>Batch email template</span>
              <textarea
                name="email-template"
                value={instructions.emailTemplate}
                onChange={(event) => setInstructions({ ...instructions, emailTemplate: event.target.value })}
              />
            </label>
            <label>
              <span>Targeting rules</span>
              <textarea
                name="targeting-rules"
                value={instructions.targetInstructions}
                onChange={(event) => setInstructions({ ...instructions, targetInstructions: event.target.value })}
              />
            </label>
            <label>
              <span>AI send quirks</span>
              <textarea
                name="ai-send-quirks"
                value={instructions.aiInstructions}
                onChange={(event) => setInstructions({ ...instructions, aiInstructions: event.target.value })}
              />
            </label>
          </div>

          <OperationalPanel
            preflight={preflight}
            settings={batchSettings}
            onExportPayload={() => downloadJson("outreach-run-plan.json", buildBackendPayload(jobs, batchSettings))}
            onSelectReady={selectReadyOnly}
          />

          <div className="toolbar">
            <div className="searchbox">
              <Search size={16} />
              <input name="job-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="company, role, ID" />
            </div>
            <select
              name="job-status-filter"
              aria-label="Filter jobs by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="active">active</option>
              <option value="recent">recent</option>
              <option value="sent">sent</option>
              <option value="all">all</option>
            </select>
            <button className="small-button" onClick={selectVisible}><Check size={15} /> Select</button>
            <button className="small-button" onClick={clearSelection}>Clear</button>
            <button className="small-button add-application-button" onClick={() => setShowApplicationEntry(true)}><Plus size={15} /> Add application</button>
          </div>

          <div className="job-table" aria-label="Application jobs" tabIndex={0}>
            <div className="job-header" aria-hidden="true">
              <span></span>
              <span>State</span>
              <span>Company</span>
              <span>Role</span>
              <span>ID</span>
              <span>Contacts</span>
              <span>Source</span>
            </div>
            {filteredJobs.map((job) => (
              <JobTableRow
                key={job.id}
                job={job}
                selected={selectedIds.has(job.id)}
                contactTarget={contactTarget}
                onToggle={() => toggleJob(job.id)}
              />
            ))}
            {!filteredJobs.length && <div className="empty-state">No rows.</div>}
          </div>
          {editableJob && (
            <JobEditor
              job={editableJob}
              profiles={profiles}
              onChange={(update) => updateJob(editableJob.id, update)}
              onDelete={() => deleteJob(editableJob)}
            />
          )}
          </div>
          {workspaceTab === "writing" && (
            <div data-tutorial-region="writing" data-tutorial-active={tutorialTarget === "writing" ? "true" : undefined}><WritingStudio
              selectedJobs={selectedJobs}
              jobs={jobs}
              drafts={drafts}
              profiles={profiles}
              activeProfile={profile}
              contactTarget={contactTarget}
              preferences={writing}
              onPreferences={(value) => setWriting(normalizeWritingPreferences(value))}
              onDrafts={setDrafts}
              onGenerate={generateDraftMessages}
            /></div>
          )}
          {workspaceTab === "source" && (
            <div data-tutorial-region="source" data-tutorial-active={tutorialTarget === "source" ? "true" : undefined}><SourceWorkspace
              source={sourceState}
              rows={jobs.length}
              warnings={importMeta.warnings}
              importedSheets={importMeta.importedSheets}
              importState={importState}
              linkedFilesSupported={supportsLinkedFiles()}
              autoSync={autoSync}
              onAutoSync={setAutoSync}
              onLink={() => setImportIntent("linked")}
              onUpload={() => setImportIntent("upload")}
              onPull={() => void pullLinkedSource()}
              onSave={() => void saveLinkedSource()}
              onExportCsv={() => downloadText(sourceState.fileName.replace(/\.(xlsx|csv)$/i, "") + "-synced.csv", serializeJobsToCsv(jobs), "text/csv")}
              onSample={() => void loadSampleRows()}
              onClear={clearWorkspace}
              onExportWorkspace={exportWorkspace}
              onImportWorkspace={() => workspaceInputRef.current?.click()}
              onAddApplication={() => setShowApplicationEntry(true)}
            /></div>
          )}
          {workspaceTab === "calendar" && <CalendarWorkspace jobs={jobs} preferences={calendarPreferences} onPreferences={setCalendarPreferences} tutorialActive={tutorialTarget === "calendar"} />}
          {workspaceTab === "profiles" && (
            <ProfileManager
              profiles={profiles}
              activeKey={profile}
              jobs={jobs}
              newLabel={newProfileLabel}
              newSender={newProfileSender}
              onSelect={setProfile}
              onNewLabel={setNewProfileLabel}
              onNewSender={setNewProfileSender}
              onAdd={addProfile}
              onDelete={deleteActiveProfile}
              onUpdate={updateActiveProfile}
            />
          )}
          {workspaceTab === "customize" && (
            <div data-tutorial-region="customize" data-tutorial-active={tutorialTarget === "customize" ? "true" : undefined}><CustomizationView
              value={workflow}
              onChange={(value) => setWorkflow(normalizeWorkflowPreferences(value))}
              onReset={resetCustomization}
              onExport={exportConfiguration}
              onImport={() => configurationInputRef.current?.click()}
              onResetPanels={resetPanelSizes}
            /></div>
          )}
        </section>

        <div className="panel-resizer" role="separator" aria-label="Resize right column" aria-orientation="vertical" aria-valuemin={260} aria-valuemax={520} aria-valuenow={workflow.rightPanelWidth} tabIndex={0} onPointerDown={(event) => beginPanelResize("right", event)} onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          resizePanel("right", event.key === "ArrowLeft" ? 10 : -10);
        }}><GripVertical size={16} /></div>

        <aside className="report-panel" data-tutorial-region={tutorialTarget === "mailbox" ? "mailbox" : "right"} data-tutorial-active={tutorialTarget === "right" || tutorialTarget === "mailbox" ? "true" : undefined}>
          <div className="right-tabs">
            <button className={rightTab === "report" ? "active" : ""} onClick={() => setRightTab("report")}>
              <Send size={15} />
              Run Summary
            </button>
            <button className={rightTab === "queue" ? "active" : ""} onClick={() => setRightTab("queue")}>
              <Check size={15} />
              Queue
            </button>
            {workflow.modules.mailbox && <button className={`${rightTab === "mailbox" ? "active" : ""} ${mailboxEvents.length ? "attention" : ""}`} onClick={() => { setRightTab("mailbox"); void refreshBackendData(); }}>
              <Inbox size={15} />
              Mail{mailboxEvents.length ? ` ${mailboxEvents.length}` : ""}
            </button>}
            {workflow.modules.recovery && <button className={rightTab === "recovery" ? "active" : ""} onClick={() => { setRightTab("recovery"); void refreshBackendData(); }}>
              <ShieldAlert size={15} />
              Recovery
            </button>}
            <button className={rightTab === "setup" ? "active" : ""} onClick={() => { setRightTab("setup"); void runHealthCheck(); void refreshBackendData(); }}><Settings size={15} />Setup</button>
            {workflow.modules.debug && <button className={rightTab === "debug" ? "active" : ""} onClick={() => setRightTab("debug")}>
              <Bug size={15} />
              Debug
            </button>}
          </div>
          {(workflow.modules.crm || workflow.modules.statistics) && <details className="advanced-tools" open={rightTab === "crm" || rightTab === "stats"}>
            <summary>Advanced records</summary>
            <div>{workflow.modules.crm && <button className={rightTab === "crm" ? "active" : ""} onClick={() => { setRightTab("crm"); void refreshBackendData(); }}><Building2 size={14} /> Contacts & history</button>}{workflow.modules.statistics && <button className={rightTab === "stats" ? "active" : ""} onClick={() => { setRightTab("stats"); void refreshBackendData(); }}><ChartNoAxesCombined size={14} /> Activity totals</button>}</div>
          </details>}

          {rightTab === "report" ? (
            <>
              <PanelTitle icon={<Send size={16} />} label="Run Summary" />
              {report ? (
                <ReportView
                  report={report}
                  history={reportHistory}
                  onExportJson={() => downloadJson(`${report.runId}.json`, report)}
                  onExportCsv={() => downloadText(`${report.runId}.csv`, reportToCsv(report), "text/csv")}
                />
              ) : (
                <div className="empty-report">No run summary yet.</div>
              )}
            </>
          ) : rightTab === "queue" ? (
            <>
              <PanelTitle icon={<Check size={16} />} label="Queue Review" />
              <QueueView preflight={preflight} />
            </>
          ) : rightTab === "crm" ? (
            <>
              <PanelTitle icon={<Building2 size={16} />} label="Company CRM" />
              <BackendRefresh error={backendDataError} onRefresh={() => void refreshBackendData()} />
              <CrmView
                companies={crmCompanies}
                detail={selectedCompany}
                onSelect={(id) => void selectCrmCompany(id)}
                onSaveContact={saveCrmContact}
                onSaveOutreach={saveHistoricalOutreach}
                onToggleSuppression={() => void toggleCompanySuppression()}
              />
            </>
          ) : rightTab === "mailbox" ? (
            <>
              <PanelTitle icon={<Inbox size={16} />} label="Mailbox Events" />
              <BackendRefresh error={backendDataError} onRefresh={() => void syncMailboxes()} />
              <MailboxView events={mailboxEvents} onDismiss={(id) => void dismissMailboxEvent(id)} />
            </>
          ) : rightTab === "recovery" ? (
            <>
              <PanelTitle icon={<ShieldAlert size={16} />} label="Recovery Center" />
              <BackendRefresh error={backendDataError} onRefresh={() => void refreshBackendData()} />
              <RecoveryView exceptions={recoveryExceptions} onResolve={(id, resolution) => void resolveException(id, resolution)} />
            </>
          ) : rightTab === "stats" ? (
            <><PanelTitle icon={<ChartNoAxesCombined size={16} />} label="Status & Activity" /><StatsView dashboard={dashboard} /></>
          ) : rightTab === "setup" ? (
            <><PanelTitle icon={<Settings size={16} />} label="Setup" /><SetupView status={setupStatus} health={backendHealth} backendUrl={backendUrl} profiles={profiles} aiConnection={aiConnection} aiConnectionCheck={aiConnectionCheck} integrations={integrations} storage={storage} storageStatus={externalStorageStatus} onStorageChange={setStorage} onStorageTest={() => void testExternalStorage()} onStoragePull={() => void pullExternalWorkspace()} onStoragePush={() => void pushExternalWorkspace()} onAiChange={setAiConnection} onAiCheck={() => void runAiConnectionCheck()} onOpenOnboarding={() => openOnboarding(0)} onStartFresh={() => setShowFreshStart(true)} onCheck={() => { void runHealthCheck(); void refreshBackendData(); if (aiConnection.controlMode === "in_app") void runAiConnectionCheck(); }} onExportIncident={() => void downloadIncidentReport(backendUrl)} /></>
          ) : (
            <>
              <PanelTitle icon={<Bug size={16} />} label="Potential Issues" />
              <DebugView
                issues={issues}
                jobs={jobs}
                activeProfile={profile}
                settings={batchSettings}
                preflight={preflight}
                backendHealth={backendHealth}
              />
            </>
          )}

          <PanelTitle icon={<Terminal size={16} />} label="Console" />
          <div className="console">
            {consoleLines.map((line, index) => (
              <div key={`${line}-${index}`}>
                <span>$</span> {line}
              </div>
            ))}
          </div>
        </aside>
      </section>
      <input
        ref={compatibilityInputRef}
        className="hidden-file-input"
        name="application-data-import"
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImport(file);
          event.target.value = "";
        }}
      />
      <input
        ref={workspaceInputRef}
        className="hidden-file-input"
        name="workspace-import"
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importWorkspace(file);
          event.target.value = "";
        }}
      />
      <input
        ref={configurationInputRef}
        className="hidden-file-input"
        name="configuration-import"
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importConfiguration(file);
          event.target.value = "";
        }}
      />
      {importIntent && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setImportIntent(null)}>
          <section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="eyebrow">Before you connect a file</span><h2 id="import-title">Application file columns</h2></div><button className="icon-button" title="Close" onClick={() => setImportIntent(null)}><X size={18} /></button></header>
            <p>The app matches common header variations, but these three fields must be present for each application.</p>
            <div className="column-contract">
              {REQUIRED_COLUMNS.map((column) => <code key={column}>{column}</code>)}
            </div>
            <p className="modal-note"><strong>Recommended for better drafts:</strong> {RECOMMENDED_COLUMNS.join(", ")}.</p>
            <div className="format-note">
              <FileSpreadsheet size={18} />
              <span><strong>CSV is recommended.</strong> Linked CSV files save changes back automatically. XLSX files can be imported and monitored, but are exported as CSV to keep this app lightweight.</span>
            </div>
            <footer><button className="ghost-button" onClick={() => setImportIntent(null)}>Cancel</button><button className="launch-button" onClick={confirmImportIntent}>{importIntent === "linked" ? "Choose linked file" : "Choose upload"}</button></footer>
          </section>
        </div>
      )}
      {showFreshStart && <FreshStartModal backendUrl={backendUrl} browserCounts={{ jobs: jobs.length, drafts: drafts.length, summaries: reportHistory.length, profiles: profiles.length }} onClose={() => setShowFreshStart(false)} onComplete={startFresh} />}
      {showOnboarding && <OnboardingWizard initialStep={onboardingEntryStep} initialSettings={integrations} profiles={profiles} aiConnection={aiConnection} aiConnectionCheck={aiConnectionCheck} backendUrl={backendUrl} storage={storage} onStorageChange={setStorage} onAiChange={setAiConnection} onAiCheck={() => void runAiConnectionCheck()} onBackendUrlChange={setBackendUrl} onManageProfiles={manageProfilesFromOnboarding} onClose={closeOnboarding} onComplete={completeOnboarding} />}
      {showApplicationEntry && <ApplicationEntryModal profiles={profiles} activeProfile={profile} onClose={() => setShowApplicationEntry(false)} onSave={addApplication} />}
      {showTutorial && !showOnboarding && <WorkspaceTutorial initialStep={tutorial.lastStep} onNavigate={navigateTutorial} onProgress={recordTutorialStep} onClose={() => { setShowTutorial(false); setTutorialTarget(""); }} onSkip={skipTutorial} onComplete={completeTutorial} />}
    </main>
  );
}

function FreshStartModal({ backendUrl, browserCounts, onClose, onComplete }: {
  backendUrl: string;
  browserCounts: { jobs: number; drafts: number; summaries: number; profiles: number };
  onClose: () => void;
  onComplete: (clearBackend: boolean, token: string, confirmation: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState<WorkspaceResetPreview | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [clearBackend, setClearBackend] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const backendRecords = preview ? Object.values(preview.counts).reduce((sum, count) => sum + count, 0) : 0;

  async function loadPreview() {
    setPreviewState("loading");
    setPreview(null);
    setError("");
    try {
      const result = await previewWorkspaceReset(backendUrl);
      setPreview(result);
      setPreviewState("ready");
      setClearBackend(true);
    } catch (caught) {
      setPreviewState("unavailable");
      setClearBackend(false);
      setError(caught instanceof Error ? caught.message : "The local database could not be checked.");
    }
  }

  useEffect(() => { void loadPreview(); }, [backendUrl]);

  async function confirmFreshStart() {
    setRunning(true);
    setError("");
    try {
      await onComplete(clearBackend, preview?.token ?? "", confirmation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The console could not be reset.");
      setRunning(false);
      if (clearBackend) void loadPreview();
    }
  }

  return <div className="modal-backdrop fresh-start-backdrop" role="presentation" onMouseDown={() => { if (!running) onClose(); }}>
    <section className="fresh-start-modal" role="dialog" aria-modal="true" aria-labelledby="fresh-start-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="eyebrow">Local maintenance</span><h2 id="fresh-start-title">Start with a clean console</h2></div><button className="icon-button" title="Close" disabled={running} onClick={onClose}><X size={18} /></button></header>
      <p>This restarts first-run setup and clears Outreach Console history. A JSON workspace backup downloads first.</p>
      <div className="fresh-start-preserves"><ShieldAlert size={17} /><div><strong>Your connected files remain intact</strong><span>No spreadsheet, resume, <code>.env</code> file, provider credential, CLI login, or external database is deleted or modified. The console only forgets its saved link to those files.</span></div></div>
      <div className="fresh-start-counts"><span>Browser workspace<strong>{browserCounts.jobs} jobs / {browserCounts.drafts} drafts / {browserCounts.summaries} summaries</strong></span><span>Local database<strong>{previewState === "loading" ? "Checking..." : previewState === "ready" ? `${backendRecords} records` : "Unavailable"}</strong></span></div>
      <label className={`fresh-start-option ${previewState !== "ready" ? "disabled" : ""}`}><input type="checkbox" checked={clearBackend} disabled={previewState !== "ready" || running} onChange={(event) => setClearBackend(event.target.checked)} /><span><strong>Clear local SQLite history too</strong><small>{preview?.backupPlanned ? "A consistent copy is stored in a backups folder beside the SQLite file before records are cleared." : previewState === "ready" ? "This backend uses temporary storage, so no SQLite file backup is needed." : "Start or update the local service to include its CRM, mailbox, run, and recovery history."}</small></span></label>
      {previewState === "unavailable" && <button className="small-button compact" disabled={running} onClick={() => void loadPreview()}><RefreshCw size={14} /> Check again</button>}
      <label className="fresh-start-confirm"><span>Type <code>{FRESH_START_CONFIRMATION}</code> to continue</span><input aria-label="Fresh start confirmation" value={confirmation} disabled={running} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
      {error && <div className="wizard-error"><AlertTriangle size={15} />{error}</div>}
      <footer><button className="ghost-button" disabled={running} onClick={onClose}>Cancel</button><button className="danger-action" disabled={running || confirmation !== FRESH_START_CONFIRMATION || (clearBackend && !preview)} onClick={() => void confirmFreshStart()}><RotateCcw size={15} />{running ? "Starting fresh..." : "Start fresh"}</button></footer>
    </section>
  </div>;
}

function SourceWorkspace({
  source,
  rows,
  warnings,
  importedSheets,
  importState,
  linkedFilesSupported,
  autoSync,
  onAutoSync,
  onLink,
  onUpload,
  onPull,
  onSave,
  onExportCsv,
  onSample,
  onClear,
  onExportWorkspace,
  onImportWorkspace,
  onAddApplication,
}: {
  source: SourceFileState;
  rows: number;
  warnings: string[];
  importedSheets: string[];
  importState: ImportState;
  linkedFilesSupported: boolean;
  autoSync: boolean;
  onAutoSync: (value: boolean) => void;
  onLink: () => void;
  onUpload: () => void;
  onPull: () => void;
  onSave: () => void;
  onExportCsv: () => void;
  onSample: () => void;
  onClear: () => void;
  onExportWorkspace: () => void;
  onImportWorkspace: () => void;
  onAddApplication: () => void;
}) {
  const linkedCsv = source.mode === "linked" && source.format === "csv";
  return (
    <div className="source-workspace">
      <header className="workspace-heading"><div><span className="eyebrow">Source of truth</span><h2>Application Data</h2><p>Connect one working file, validate its columns, and keep outreach status synchronized.</p></div><StatusPill state={source.syncState} label={source.syncState} /></header>
      <section className="source-band">
        <div className="source-identity"><FileSpreadsheet size={24} /><div><strong>{source.fileName || "No file connected"}</strong><span>{source.message}</span></div></div>
        <div className={`data-privacy-note ${source.mode === "sample" ? "sample" : "private"}`}><ShieldAlert size={16} /><div><strong>{source.mode === "sample" ? "Synthetic public data" : source.mode === "none" ? "No private data loaded" : "Private local workspace"}</strong><span>{source.mode === "sample" ? "All companies, people, addresses, links, and activity are simulated. No provider can be called from this sample." : source.mode === "none" ? "The repository includes only the synthetic sample pack. Your own rows appear only after you import or link them." : "This filename and its rows came from this browser or your linked file. They are not embedded in the repository or public build."}</span></div></div>
        <div className="source-facts"><span>Mode<strong>{source.mode}</strong></span><span>Format<strong>{source.format}</strong></span><span>Rows<strong>{rows}</strong></span><span>Last sync<strong>{source.lastSyncedAt ? new Date(source.lastSyncedAt).toLocaleTimeString() : "never"}</strong></span></div>
        {importedSheets.length > 0 && <div className="imported-sheets"><strong>Application sheets</strong><span>{importedSheets.join(" / ")}</span></div>}
        <div className="source-actions">
          <button className="small-button primary-outline" onClick={onAddApplication}><Plus size={15} /> Add application here</button>
          <button className="small-button" onClick={onLink} disabled={!linkedFilesSupported || importState === "loading"}><Link2 size={15} /> Link working file</button>
          <button className="small-button" onClick={onUpload} disabled={importState === "loading"}><Upload size={15} /> Import a copy</button>
          <button className="small-button" onClick={onPull} disabled={source.mode !== "linked"}><ArrowDownToLine size={15} /> Pull latest</button>
          <button className="small-button" onClick={onSave} disabled={!linkedCsv}><Save size={15} /> Save now</button>
        </div>
        {!linkedFilesSupported && <div className="inline-warning"><AlertTriangle size={15} /> Linked files require Chrome or Edge. Compatibility import still works.</div>}
        <label className="sync-toggle"><input type="checkbox" checked={autoSync} onChange={(event) => onAutoSync(event.target.checked)} disabled={!linkedCsv} /><span><strong>Auto-save linked CSV</strong><small>Writes app edits to the original file after a short delay.</small></span></label>
      </section>

      <section className="source-band">
        <div className="section-heading"><div><span className="eyebrow">File contract</span><h3>Recognized columns</h3></div><button className="small-button compact" onClick={onExportCsv}><Download size={14} /> Export managed CSV</button></div>
        <div className="contract-grid"><div><strong>Required</strong><p>{REQUIRED_COLUMNS.join(", ")}</p></div><div><strong>Recommended</strong><p>{RECOMMENDED_COLUMNS.join(", ")}</p></div></div>
        {warnings.length > 0 && <div className="source-warnings">{warnings.map((warning) => <span key={warning}><AlertTriangle size={14} /> {warning}</span>)}</div>}
      </section>

      <section className="source-band utility-band">
        <div><span className="eyebrow">Workspace utilities</span><h3>Backup and test data</h3></div>
        <div className="source-actions"><button className="small-button" onClick={onSample}><RefreshCw size={15} /> Load synthetic sample</button><button className="small-button" onClick={onExportWorkspace}><Download size={15} /> Export workspace</button><button className="small-button" onClick={onImportWorkspace}><Upload size={15} /> Import workspace</button><button className="small-button danger" onClick={onClear}><Trash2 size={15} /> Clear</button></div>
      </section>
    </div>
  );
}

function CalendarWorkspace({ jobs, preferences, onPreferences, tutorialActive }: { jobs: JobRow[]; preferences: CalendarPreferences; onPreferences: (value: CalendarPreferences) => void; tutorialActive: boolean }) {
  const events = useMemo(() => buildCalendarEvents(jobs), [jobs]);
  const latestDate = events.map((event) => event.date).sort().at(-1) ?? toDateKey(new Date().toISOString());
  const [month, setMonth] = useState(() => latestDate.slice(0, 7));
  const monthDate = new Date(`${month}-15T12:00:00`);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const monthEvents = events.filter((event) => event.date.startsWith(month));
  const exportEvents = selectCalendarEvents(events, preferences, month);
  const destinationInstructions: Record<CalendarPreferences["destination"], string> = {
    google: "Download the file, then open Google Calendar settings and use Import & export.",
    outlook: "Download the file, then use Add calendar and Upload from file in Outlook.",
    apple: "Download the file, then use File and Import in Apple Calendar.",
    other: "Download the file and use your calendar's iCalendar or .ics import command.",
  };

  function moveMonth(offset: number) {
    const next = new Date(year, monthIndex + offset, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  function updateKind(kind: CalendarEvent["kind"], enabled: boolean) {
    onPreferences({ ...preferences, includedKinds: { ...preferences.includedKinds, [kind]: enabled } });
  }

  function exportCalendar() {
    const suffix = preferences.exportScope === "visible_month" ? month : "all";
    downloadText(`job-search-calendar-${suffix}.ics`, buildCalendarIcs(exportEvents, preferences), "text/calendar;charset=utf-8");
  }

  return (
    <div className="calendar-workspace" data-tutorial-region="calendar" data-tutorial-active={tutorialActive ? "true" : undefined}>
      <header className="workspace-heading"><div><span className="eyebrow">Application timeline</span><h2>Calendar</h2><p>Applications, outreach, interviews, replies, and outcomes from the connected file.</p></div><div className="calendar-summary"><strong>{monthEvents.length}</strong><span>events this month</span></div></header>
      <div className="calendar-toolbar"><button className="icon-button" title="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button><h3>{monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3><button className="icon-button" title="Next month" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button><button className="small-button compact" onClick={() => setMonth(latestDate.slice(0, 7))}>Latest activity</button></div>
      <div className="calendar-legend">{calendarEventKinds.map((kind) => <span className={kind} key={kind}><i />{kind}</span>)}</div>
      <div className="calendar-scroll">
        <div className="calendar-grid" role="grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
          {cells.map((day, index) => {
            const date = day ? `${month}-${String(day).padStart(2, "0")}` : "";
            const dayEvents = day ? monthEvents.filter((event) => event.date === date) : [];
            return <div className={`calendar-day ${day ? "" : "outside"}`} role="gridcell" key={`${month}-${index}`}><strong>{day ?? ""}</strong><div>{dayEvents.slice(0, 4).map((event) => <span className={`calendar-event ${event.kind}`} title={`${event.company}: ${event.label}`} key={event.id}><i />{event.company}</span>)}{dayEvents.length > 4 && <small>+{dayEvents.length - 4} more</small>}</div></div>;
          })}
        </div>
      </div>
      {!monthEvents.length && <div className="empty-report">No dated activity in this month.</div>}
      <section className="calendar-handoff">
        <div className="section-heading"><div><span className="eyebrow">External calendar</span><h3>Choose what leaves this app</h3></div><strong>{exportEvents.length} selected events</strong></div>
        <p>The app creates one standard .ics file. It never writes to a calendar in the background, and alerts stay off unless you choose one.</p>
        <div className="calendar-export-settings">
          <label>Calendar<select value={preferences.destination} onChange={(event) => onPreferences({ ...preferences, destination: event.target.value as CalendarPreferences["destination"] })}><option value="google">Google Calendar</option><option value="outlook">Outlook Calendar</option><option value="apple">Apple Calendar</option><option value="other">Another calendar app</option></select></label>
          <label>Export range<select value={preferences.exportScope} onChange={(event) => onPreferences({ ...preferences, exportScope: event.target.value as CalendarPreferences["exportScope"] })}><option value="visible_month">This visible month</option><option value="all_events">All dated activity</option></select></label>
          <label>Event alert<select value={preferences.reminderMinutes} onChange={(event) => onPreferences({ ...preferences, reminderMinutes: Number(event.target.value) as CalendarPreferences["reminderMinutes"] })}><option value="0">No alert</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>
        </div>
        <div className="calendar-kind-grid">
          {calendarEventKinds.map((kind) => <label key={kind} className={preferences.includedKinds[kind] ? "active" : ""}><input type="checkbox" checked={preferences.includedKinds[kind]} onChange={(event) => updateKind(kind, event.target.checked)} /><span><i className={kind} />{calendarKindLabel(kind)}</span></label>)}
        </div>
        <div className="calendar-export-action"><div><strong>{preferences.destination === "other" ? "Calendar file" : preferences.destination === "google" ? "Google Calendar" : preferences.destination === "outlook" ? "Outlook Calendar" : "Apple Calendar"}</strong><span>{destinationInstructions[preferences.destination]}</span><small>Stable event IDs help compatible calendars recognize a repeated import. Review the import screen before confirming it.</small></div><button className="launch-button" disabled={!exportEvents.length} onClick={exportCalendar}><Download size={16} /> Download .ics</button></div>
      </section>
    </div>
  );
}

function calendarKindLabel(kind: CalendarEvent["kind"]): string {
  const labels: Record<CalendarEvent["kind"], string> = { application: "Applications", outreach: "Outreach sent", interview: "Interviews", reply: "Replies / next steps", rejection: "Rejections", bounce: "Email problems", confirmation: "Application confirmations" };
  return labels[kind];
}

function ProfileManager({ profiles, activeKey, jobs, newLabel, newSender, onSelect, onNewLabel, onNewSender, onAdd, onDelete, onUpdate }: {
  profiles: ProfileDefinition[];
  activeKey: ProfileKey;
  jobs: JobRow[];
  newLabel: string;
  newSender: string;
  onSelect: (key: ProfileKey) => void;
  onNewLabel: (value: string) => void;
  onNewSender: (value: string) => void;
  onAdd: () => void;
  onDelete: () => void;
  onUpdate: (update: Partial<ProfileDefinition>) => void;
}) {
  const active = profiles.find((item) => item.key === activeKey) ?? profiles[0];
  return (
    <div className="profile-manager">
      <header className="workspace-heading"><div><span className="eyebrow">Account and resume routing</span><h2>Profiles</h2><p>Each profile owns one sender identity, resume, and set of writing notes.</p></div></header>
      <div className="profile-manager-layout">
        <nav className="profile-list">{profiles.map((item) => <button className={activeKey === item.key ? "active" : ""} key={item.key} onClick={() => onSelect(item.key)} style={{ "--accent": item.accent } as React.CSSProperties}><span>{item.label}</span><small>{jobs.filter((job) => job.profile === item.key).length} jobs</small></button>)}</nav>
        {active && <section className="profile-form"><div className="section-heading"><div><span className="eyebrow">Selected profile</span><h3>{active.label}</h3></div><button className="small-button compact danger" onClick={onDelete}><Trash2 size={14} /> Delete profile</button></div><label>Sender name<input value={active.senderName} onChange={(event) => onUpdate({ senderName: event.target.value })} /></label><label>Sender email<input type="email" value={active.senderEmail ?? ""} onChange={(event) => onUpdate({ senderEmail: event.target.value })} /></label><label>Resume path or label<input value={active.resumeLabel ?? ""} onChange={(event) => onUpdate({ resumeLabel: event.target.value })} /></label><label>Profile-specific instructions<textarea value={active.notes ?? ""} onChange={(event) => onUpdate({ notes: event.target.value })} /></label></section>}
      </div>
      <section className="new-profile"><div><span className="eyebrow">Add another role profile</span><h3>New profile</h3></div><input value={newLabel} onChange={(event) => onNewLabel(event.target.value)} placeholder="Profile name" /><input value={newSender} onChange={(event) => onNewSender(event.target.value)} placeholder="Sender name" /><button className="small-button" onClick={onAdd}><UserPlus size={15} /> Add profile</button></section>
    </div>
  );
}

function inferJobId(jobUrl: string): string {
  if (!jobUrl) return "";
  try {
    const url = new URL(jobUrl);
    for (const key of ["job_id", "jobId", "gh_jid", "requisitionId", "reqId"]) {
      const value = url.searchParams.get(key)?.trim();
      if (value) return value;
    }
    const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
    const candidate = [...segments].reverse().find((segment) => /^(?:[a-z]+[-_])?\d{4,}$|^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment));
    return candidate ?? "";
  } catch {
    return "";
  }
}

function BackendRefresh({ error, onRefresh }: { error: string; onRefresh: () => void }) {
  return (
    <div className="backend-refresh">
      <button className="small-button" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>
      {error && <span>{error}</span>}
    </div>
  );
}

function StatsView({ dashboard }: { dashboard: DashboardData | null }) {
  if (!dashboard) return <div className="empty-report">Connect backend to load statistics.</div>;
  const wanted = ["applied", "application_received", "replied", "rejected", "bounced", "interview"];
  const metricCount = (status: string) => dashboard.statuses.find((item) => item.status === status)?.count ?? (status === "bounced" ? dashboard.outreachStatuses?.find((item) => item.status === status)?.count ?? 0 : 0);
  return <div className="stats-view"><div className="stats-grid">{wanted.map((status) => <Metric key={status} label={status.replaceAll("_", " ")} value={String(metricCount(status))} />)}</div><div className="moving-average"><strong>Outreach moving average</strong><span>{dashboard.activity.dailyAverage7.toFixed(1)} / day (7d)</span><span>{dashboard.activity.dailyAverage30.toFixed(1)} / day (30d)</span></div><div className="provider-usage"><strong>Provider usage</strong>{dashboard.usage.map((item) => <span key={`${item.provider}-${item.operation}`}>{item.provider} / {item.operation}: {item.requests} requests, {item.credits} estimated credits</span>)}</div></div>;
}

function OnboardingWizard({ initialStep, initialSettings, profiles, aiConnection, aiConnectionCheck, backendUrl, storage, onStorageChange, onAiChange, onAiCheck, onBackendUrlChange, onManageProfiles, onClose, onComplete }: {
  initialStep: number;
  initialSettings: IntegrationSettings;
  profiles: ProfileDefinition[];
  aiConnection: AiConnectionSettings;
  aiConnectionCheck: AiConnectionCheck | null;
  backendUrl: string;
  storage: StorageSettings;
  onStorageChange: (value: StorageSettings) => void;
  onAiChange: (value: AiConnectionSettings) => void;
  onAiCheck: () => void;
  onBackendUrlChange: (value: string) => void;
  onManageProfiles: (step: number, doNotPrompt: boolean, settings: IntegrationSettings) => void;
  onClose: (step: number, doNotPrompt: boolean, settings: IntegrationSettings) => void;
  onComplete: (settings: IntegrationSettings) => Promise<void>;
}) {
  const [step, setStep] = useState(Math.min(4, Math.max(0, initialStep)));
  const [settings, setSettings] = useState(initialSettings);
  const [doNotPrompt, setDoNotPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingBackend, setTestingBackend] = useState(false);
  const [foundationHealth, setFoundationHealth] = useState<BackendHealth | null>(null);
  const [copiedProvider, setCopiedProvider] = useState("");
  const [error, setError] = useState("");
  const connections = [
    { role: "primary contact discovery", selection: settings.primaryEnrichment, options: enrichmentOptions, update: (value: IntegrationSettings["primaryEnrichment"]) => setSettings({ ...settings, primaryEnrichment: value }) },
    ...(settings.fallbackEnrichment.enabled ? [{ role: "fallback contact discovery", selection: settings.fallbackEnrichment, options: enrichmentOptions, update: (value: IntegrationSettings["primaryEnrichment"]) => setSettings({ ...settings, fallbackEnrichment: value }) }] : []),
    { role: "email, drafts, and replies", selection: settings.mailbox, options: mailboxOptions, update: (value: IntegrationSettings["primaryEnrichment"]) => setSettings({ ...settings, mailbox: value }) },
  ];
  const activeAiRecipe = aiConnectionRecipes[aiConnection.mode];
  const activeAiCheck = aiConnectionCheck?.mode === aiConnection.mode ? aiConnectionCheck : null;
  const aiLoginLabel = activeAiCheck?.status === "ready" ? "Verified" : activeAiCheck?.status === "checking" ? "Checking" : activeAiCheck ? "Needs attention" : "Not tested";
  const moveToStep = (nextStep: number) => { setError(""); setStep(Math.min(4, Math.max(0, nextStep))); };
  async function finish() {
    setSaving(true); setError("");
    try { await onComplete(settings); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Setup could not be saved."); setSaving(false); }
  }
  async function testBackend() {
    setTestingBackend(true);
    const result = await checkBackendHealth(backendUrl);
    setFoundationHealth(result);
    setTestingBackend(false);
  }
  async function copyAdapterPrompt(option: IntegrationOption, role: string) {
    try {
      await navigator.clipboard.writeText(buildAdapterPrompt(option, role));
      setCopiedProvider(option.id);
    } catch {
      setError("The installation prompt could not be copied. Open the adapter contract and use its prompt manually.");
    }
  }
  const chooseControlMode = (controlMode: AiControlMode) => {
    setError("");
    if (controlMode === "in_app" && storage.mode === "browser") onStorageChange({ ...storage, mode: "sqlite" });
    if (controlMode === "in_app" && aiConnection.mode === "manual") {
      const preset = aiConnectionRecipes.codex_cli;
      onAiChange({ ...aiConnection, controlMode, mode: "codex_cli", baseUrl: preset.baseUrl ?? "", apiKeyEnv: preset.apiKeyEnv ?? "" });
    } else onAiChange({ ...aiConnection, controlMode, mode: controlMode === "templates_only" ? "manual" : aiConnection.mode });
  };
  return (
    <div className="modal-backdrop onboarding-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <header><div><span className="eyebrow">Initial setup</span><h2 id="onboarding-title">Configure Outreach Console</h2></div><button className="icon-button" title="Save progress and close" onClick={() => onClose(step, doNotPrompt, settings)}><X size={18} /></button></header>
        <nav className="onboarding-progress" aria-label="Setup progress">{["Foundation", "Providers", "Connections", "Storage", "Review"].map((label, index) => <button key={label} className={index === step ? "active" : index < step ? "done" : ""} onClick={() => moveToStep(index)}><span>{index < step ? <Check size={13} /> : index + 1}</span>{label}</button>)}</nav>
        <div className="onboarding-content">
          {step === 0 && <section className="foundation-step">
            <div><h3>How will AI operate this workflow?</h3><p>This choice decides where provider connections live and which checks the console can perform.</p></div>
            <div className="ai-control-options">
              <button className={aiConnection.controlMode === "external_operator" ? "active" : ""} onClick={() => chooseControlMode("external_operator")}><Terminal size={18} /><span><strong>AI operates from outside</strong><small>Codex, Claude, or another agent surrounds the console and uses its own MCPs or connectors.</small></span></button>
              <button className={aiConnection.controlMode === "in_app" ? "active" : ""} onClick={() => chooseControlMode("in_app")}><Sparkles size={18} /><span><strong>The console calls an AI</strong><small>Configure a local CLI or API adapter used only by this application.</small></span></button>
              <button className={aiConnection.controlMode === "templates_only" ? "active" : ""} onClick={() => chooseControlMode("templates_only")}><FileSpreadsheet size={18} /><span><strong>Templates only</strong><small>Prepare queues and drafts without an LLM connection.</small></span></button>
            </div>
            {aiConnection.controlMode === "external_operator" && <div className="ownership-note"><strong>Externally managed</strong><span>The outside AI must be able to reach this console and every provider it is expected to use. Give it the operator guide so it follows the selected ownership mode and does not duplicate provider calls or sends.</span><a href="/AI_OPERATOR_GUIDE.md" target="_blank" rel="noreferrer">Open AI operator guide</a></div>}
            {aiConnection.controlMode === "in_app" && <InlineAiConfiguration value={aiConnection} check={aiConnectionCheck} onChange={onAiChange} onCheck={onAiCheck} />}
            {aiConnection.controlMode === "templates_only" && <div className="ownership-note"><strong>No AI connection required</strong><span>Contact providers and mailbox adapters can still run locally, but personalized writing remains template-driven.</span></div>}
            <div className="foundation-grid">
              <section className="foundation-card"><header><div><span className="eyebrow">Identity and routing</span><h4>Profiles</h4></div><button className="small-button compact" onClick={() => onManageProfiles(step, doNotPrompt, settings)}><Settings size={14} /> Manage</button></header><div className="foundation-profiles">{profiles.length ? profiles.map((item) => <button key={item.key} onClick={() => onManageProfiles(step, doNotPrompt, settings)}><strong>{item.label}</strong><small>{item.senderEmail || item.senderName || "Sender not configured"}</small><span>{item.resumeLabel || "Resume not configured"}</span></button>) : <button onClick={() => onManageProfiles(step, doNotPrompt, settings)}><strong>Add a profile</strong><small>A sender and resume are required for local operation.</small></button>}</div></section>
              <section className="foundation-card"><header><div><span className="eyebrow">Local service</span><h4>Backend address</h4></div>{foundationHealth && <StatusPill state={foundationHealth.status === "ok" ? "ready" : "error"} label={foundationHealth.status} />}</header><p>The uncommon default port reduces collisions. Change it only when the backend was started on a different local port.</p><label>Local URL<input aria-label="Initial backend URL" value={backendUrl} onChange={(event) => { onBackendUrlChange(event.target.value); setFoundationHealth(null); }} /></label><div className="foundation-actions"><button className="ghost-button" onClick={() => onBackendUrlChange(DEFAULT_BACKEND_URL)}>Use default</button><button className="small-button" disabled={testingBackend} onClick={() => void testBackend()}><RefreshCw size={14} /> {testingBackend ? "Testing..." : "Test local service"}</button></div>{foundationHealth && <small>{foundationHealth.message}</small>}</section>
            </div>
          </section>}
          {step === 1 && <section className="provider-step"><h3>Choose operational providers</h3><p>A provider can be owned by the outside AI or by this console. The next step gives the correct connection path for the AI mode selected on Foundation.</p><ProviderSelect label="Primary contact discovery" selection={settings.primaryEnrichment} options={enrichmentOptions} onChange={(value) => setSettings({ ...settings, primaryEnrichment: value })} /><label className="toggle-row"><input type="checkbox" checked={settings.fallbackEnrichment.enabled} onChange={(event) => setSettings({ ...settings, fallbackEnrichment: event.target.checked ? { ...settings.fallbackEnrichment, enabled: true, providerId: settings.fallbackEnrichment.providerId === "none" ? "skrapp" : settings.fallbackEnrichment.providerId, label: settings.fallbackEnrichment.providerId === "none" ? "Skrapp" : settings.fallbackEnrichment.label } : { ...selectIntegration("none", enrichmentOptions), enabled: false } })} /><span><strong>Use a fallback contact provider</strong><small>Disable this if one provider or manual research is enough.</small></span></label>{settings.fallbackEnrichment.enabled && <ProviderSelect label="Fallback contact discovery" selection={settings.fallbackEnrichment} options={enrichmentOptions.filter((item) => item.id !== "none")} onChange={(value) => setSettings({ ...settings, fallbackEnrichment: value })} />}<ProviderSelect label="Email, drafts, and replies" selection={settings.mailbox} options={mailboxOptions} onChange={(value) => setSettings({ ...settings, mailbox: value })} /></section>}
          {step === 2 && <section className="connection-step"><h3>{aiConnection.controlMode === "external_operator" ? "Connect providers to the outside AI" : "Connect providers to the local console"}</h3><p>{aiConnection.controlMode === "external_operator" ? "Use existing connectors or official MCP servers in the AI environment. Installing duplicate adapters inside this console is optional." : "Included adapters remain lightweight. Other providers require a small local adapter that follows the documented contract."}</p><div className="connection-list">{connections.map((item) => <ConnectionCard key={item.role} role={item.role} selection={item.selection} options={item.options} controlMode={aiConnection.controlMode} copied={copiedProvider === item.selection.providerId} onChange={item.update} onCopy={(option) => void copyAdapterPrompt(option, item.role)} />)}</div>{error && <div className="wizard-error"><AlertTriangle size={15} />{error}</div>}<div className="connection-value"><span>Local service</span><code>{backendUrl || "Not configured"}</code></div></section>}
          {step === 3 && <><StorageSetup value={storage} onChange={onStorageChange} />{aiConnection.controlMode === "in_app" && storage.mode === "browser" && <div className="wizard-error"><AlertTriangle size={15} />Console-managed AI needs the lightweight local service. Choose Embedded SQLite, or switch Foundation to Outside AI or Templates only.</div>}</>}
          {step === 4 && <section className="review-step">
            <h3>Review and verify setup</h3>
            <div className="review-grid">
              <span>AI ownership<strong>{controlModeLabel(aiConnection.controlMode)}</strong></span>
              {aiConnection.controlMode === "in_app" && <><span>AI connection<strong>{activeAiRecipe.title}</strong></span><span>Plan login<strong>{aiLoginLabel}</strong></span><span>Plan-only guard<strong>{activeAiRecipe.planBacked ? aiConnection.strictPlanOnly ? "Confirmed" : "Not confirmed" : "Not applicable"}</strong></span></>}
              <span>Profiles<strong>{profiles.length || "None"}</strong></span>
              <span>Storage<strong>{storage.mode === "browser" ? "Browser only" : storage.mode === "sqlite" ? "Embedded SQLite" : `Existing ${storage.externalDialect}`}</strong></span>
              <span>Local service<strong>{storage.mode === "browser" ? aiConnection.controlMode === "in_app" ? "Required; choose SQLite" : "Optional" : backendUrl}</strong></span>
              <span>Primary contact discovery<strong>{settings.primaryEnrichment.label}</strong></span>
              <span>Fallback<strong>{settings.fallbackEnrichment.enabled ? settings.fallbackEnrichment.label : "Disabled"}</strong></span>
              <span>Email service<strong>{settings.mailbox.label}</strong></span>
            </div>
            {aiConnection.controlMode === "in_app" && <div className={`review-ai-check ${activeAiCheck?.status === "ready" ? "ready" : activeAiCheck ? "error" : ""}`}><div><strong>{aiLoginLabel}</strong><span>{activeAiCheck?.detail ?? "Verify the selected plan login before finishing setup."}</span></div><button type="button" className="small-button" disabled={activeAiCheck?.status === "checking"} onClick={onAiCheck}><RefreshCw size={14} />{activeAiCheck?.status === "checking" ? "Checking..." : "Verify plan login"}</button></div>}
            <div className="inline-note"><ShieldAlert size={15} /> {aiConnection.controlMode === "in_app" && storage.mode === "browser" ? "Console-managed AI needs the lightweight local service. Go back to Storage and choose Embedded SQLite before finishing." : storage.mode === "browser" ? "Browser-only mode can finish without a local service. Provider actions, CRM, mailbox ingestion, and recovery automation stay off." : aiConnection.controlMode === "external_operator" ? "The console verifies its local service; your outside AI is responsible for verifying its own provider connectors." : "Setup will remain incomplete until the plan login, billing guard, local adapters, sender routing, and resumes pass."}</div>
            {error && <div className="wizard-error"><AlertTriangle size={15} />{error}</div>}
          </section>}
        </div>
        <footer><label className="do-not-prompt"><input type="checkbox" checked={doNotPrompt} onChange={(event) => setDoNotPrompt(event.target.checked)} /> Do not open setup automatically again</label><div><button className="ghost-button" disabled={step === 0 || saving} onClick={() => moveToStep(step - 1)}>Back</button>{step < 4 ? <button className="launch-button" onClick={() => moveToStep(step + 1)}>Continue</button> : <button className="launch-button" disabled={saving || !profiles.length} onClick={() => void finish()}>{saving ? "Verifying..." : "Save and verify setup"}</button>}</div></footer>
      </section>
    </div>
  );
}

function InlineAiConfiguration({ value, check, onChange, onCheck }: { value: AiConnectionSettings; check: AiConnectionCheck | null; onChange: (value: AiConnectionSettings) => void; onCheck: () => void }) {
  const recipe = aiConnectionRecipes[value.mode];
  const apiMode = value.mode.endsWith("_api") || value.mode === "openai_compatible";
  const bundledCompatibleApi = ["gemini_api", "groq_api", "openrouter_api", "deepseek_api", "kimi_api", "mistral_api", "together_api", "cerebras_api"].includes(value.mode);
  const planMode = recipe.planBacked === true;
  const activeCheck = check?.mode === value.mode ? check : null;
  const [copiedCommand, setCopiedCommand] = useState("");
  const changeMode = (mode: AiConnectionSettings["mode"]) => {
    const preset = aiConnectionRecipes[mode];
    onChange({ ...value, mode, baseUrl: preset.baseUrl ?? "", apiKeyEnv: preset.apiKeyEnv ?? "", strictPlanOnly: false });
  };
  async function copyCommand(label: string, command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(label);
      window.setTimeout(() => setCopiedCommand(""), 1500);
    } catch {
      setCopiedCommand("");
    }
  }
  const statusState = activeCheck?.status === "ready" ? "ready" : activeCheck?.status === "checking" ? "idle" : activeCheck ? "error" : "setup";
  return <div className="inline-ai-config">
    <label>AI connection<select aria-label="Initial AI connection" value={value.mode} onChange={(event) => changeMode(event.target.value as AiConnectionSettings["mode"])}><optgroup label="Use an existing plan"><option value="codex_cli">ChatGPT plan / Codex CLI</option><option value="claude_cli">Claude plan / Claude Code</option><option value="cursor_cli">Cursor plan / Cursor CLI</option><option value="opencode_cli">OpenCode Go plan</option></optgroup><optgroup label="Local model"><option value="ollama">Ollama local model</option></optgroup><optgroup label="Common lower-cost APIs"><option value="deepseek_api">DeepSeek API</option><option value="kimi_api">Kimi API</option><option value="mistral_api">Mistral API</option><option value="together_api">Together AI API</option><option value="cerebras_api">Cerebras Inference API</option><option value="groq_api">Groq API</option><option value="openrouter_api">OpenRouter API</option></optgroup><optgroup label="Other separate API billing"><option value="openai_api">OpenAI API</option><option value="anthropic_api">Anthropic API</option><option value="gemini_api">Google Gemini API</option><option value="openai_compatible">Other OpenAI-compatible API</option></optgroup></select></label>
    <label>{planMode ? "Model (optional)" : "Model"}<input list={value.mode === "opencode_cli" ? "opencode-go-models" : undefined} value={value.model} onChange={(event) => onChange({ ...value, model: event.target.value })} placeholder={recipe.modelPlaceholder ?? "Provider model ID"} /></label>
    {value.mode === "opencode_cli" && <datalist id="opencode-go-models">{(activeCheck?.availableModels ?? []).map((model) => <option key={model} value={model} />)}</datalist>}
    {(value.mode === "ollama" || apiMode) && <label>Base URL<input value={value.baseUrl} readOnly={bundledCompatibleApi} onChange={(event) => onChange({ ...value, baseUrl: event.target.value })} placeholder={recipe.baseUrl} />{bundledCompatibleApi && <small>Fixed to the provider's official endpoint.</small>}</label>}
    {apiMode && <label>API key environment variable<input value={value.apiKeyEnv} readOnly={bundledCompatibleApi} onChange={(event) => onChange({ ...value, apiKeyEnv: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} />{bundledCompatibleApi && <small>Fixed in the backend so another browser value cannot be read or sent.</small>}</label>}
    {planMode && <div className="cli-login-definition"><Terminal size={15} /><div><strong>What "signed in through the CLI" means</strong><span>The provider's command-line app is installed for the same operating-system account that runs this backend. You complete its browser or device login once, and the CLI saves the account credential in its own local credential store. This console invokes that signed-in CLI; it does not ask for or store your model API key.</span></div></div>}
    {planMode && <div className="plan-login-assurance"><Check size={15} /><div><strong>Existing plan path; separate API credentials are blocked</strong><span>{recipe.billing}</span></div></div>}
    <div className="ai-connection-guide">
      <div className="ai-guide-heading"><div><strong>{recipe.title}</strong><span>{recipe.adapter}</span></div>{recipe.docs && <a href={recipe.docs} target="_blank" rel="noreferrer">Official setup</a>}</div>
      <ol>{recipe.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      {recipe.caveat && <div className="ai-caveat"><AlertTriangle size={14} /><span>{recipe.caveat}</span></div>}
      {planMode && <div className="ai-command-list">
        {[{ label: "Install", command: recipe.installCommand }, { label: "Sign in", command: recipe.loginCommand }, { label: "Check", command: recipe.statusCommand }].filter((item): item is { label: string; command: string } => Boolean(item.command)).map((item) => <div key={item.label}><span>{item.label}</span><code>{item.command}</code><button type="button" className="icon-button" title={`Copy ${item.label.toLowerCase()} command`} onClick={() => void copyCommand(item.label, item.command)}>{copiedCommand === item.label ? <Check size={14} /> : <Copy size={14} />}</button></div>)}
      </div>}
      {planMode && <label className="strict-plan-check"><input type="checkbox" checked={value.strictPlanOnly} onChange={(event) => onChange({ ...value, strictPlanOnly: event.target.checked })} /><span><strong>Strict plan-only guard</strong><small>{recipe.strictPlanInstruction}</small>{recipe.billingSettingsUrl && <a href={recipe.billingSettingsUrl} target="_blank" rel="noreferrer">Open billing setting</a>}</span></label>}
      <div className="ai-test-row"><button type="button" className="small-button" disabled={activeCheck?.status === "checking"} onClick={onCheck}><RefreshCw size={14} /> {activeCheck?.status === "checking" ? "Checking..." : planMode ? "Test plan login" : "Test connection"}</button><StatusPill state={statusState} label={activeCheck?.status.replaceAll("_", " ") ?? "not tested"} />{activeCheck?.version && <code>{activeCheck.version}</code>}</div>
      {activeCheck && <small className={activeCheck.status === "ready" ? "ai-check-detail ready" : "ai-check-detail"}>{activeCheck.detail}</small>}
    </div>
  </div>;
}

function ConnectionCard({ role, selection, options, controlMode, copied, onChange, onCopy }: { role: string; selection: IntegrationSettings["primaryEnrichment"]; options: IntegrationOption[]; controlMode: AiControlMode; copied: boolean; onChange: (value: IntegrationSettings["primaryEnrichment"]) => void; onCopy: (option: IntegrationOption) => void }) {
  const option = integrationOption(selection, options);
  const externallyManaged = controlMode === "external_operator";
  const status = option.adapter === "built_in" ? "included" : option.adapter === "disabled" ? "disabled" : externallyManaged && option.mcpUrl ? "official MCP" : "guided install";
  const installPrompt = option.adapter === "external" ? buildAdapterPrompt(option, role) : "";
  return <article><header><div><strong>{selection.label}</strong><small>{role}</small></div><StatusPill state={option.adapter === "built_in" ? "ready" : option.adapter === "disabled" ? "idle" : "setup"} label={status} /></header><p>{option.setup}</p>{selection.enabled && selection.credentialEnv && <label>Credential environment variable<input value={selection.credentialEnv} onChange={(event) => onChange({ ...selection, credentialEnv: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} /></label>}{externallyManaged && option.mcpUrl && <div className="connection-value"><span>Official MCP</span><code>{option.mcpUrl}</code></div>}<div className="adapter-actions"><a className="small-button" href={option.docs} target="_blank" rel="noreferrer">Setup documentation</a>{option.adapter === "external" && <button className="ghost-button" onClick={() => onCopy(option)}>{copied ? "Prompt copied" : "Copy install prompt"}</button>}</div>{option.adapter === "external" && <details className="install-prompt"><summary>View install prompt</summary><textarea aria-label={`${selection.label} install prompt`} readOnly value={installPrompt} /></details>}<small>{option.adapter === "built_in" ? "The adapter code is included, but authorization is still required." : externallyManaged ? "Your outside AI owns this connection. Do not also configure local execution unless you intentionally want both paths." : "The console cannot use this provider until the local adapter passes its connection test."}</small></article>;
}

function controlModeLabel(mode: AiControlMode): string {
  if (mode === "external_operator") return "Outside AI operator";
  if (mode === "in_app") return "Console-managed AI";
  return "Templates only";
}

function ProviderSelect({ label, selection, options, onChange }: { label: string; selection: IntegrationSettings["primaryEnrichment"]; options: IntegrationOption[]; onChange: (value: IntegrationSettings["primaryEnrichment"]) => void }) {
  const option = integrationOption(selection, options);
  const custom = selection.providerId.startsWith("custom_");
  return <div className="provider-selector"><label><span>{label}</span><select aria-label={label} value={selection.providerId} onChange={(event) => onChange(selectIntegration(event.target.value, options))}>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{custom && <label><span>Display name</span><input aria-label={`${label} display name`} value={selection.label} onChange={(event) => onChange({ ...selection, label: event.target.value || option.label })} placeholder="Provider name" /></label>}<small>{option.adapter === "built_in" ? "Adapter included; credentials and helper configuration are still required." : option.adapter === "disabled" ? option.setup : "External adapter required before this can run."}</small></div>;
}

function SetupView({ status, health, backendUrl, profiles, aiConnection, aiConnectionCheck, integrations, storage, storageStatus, onStorageChange, onStorageTest, onStoragePull, onStoragePush, onAiChange, onAiCheck, onOpenOnboarding, onStartFresh, onCheck, onExportIncident }: {
  status: SetupStatus | null;
  health: BackendHealth;
  backendUrl: string;
  profiles: ProfileDefinition[];
  aiConnection: AiConnectionSettings;
  aiConnectionCheck: AiConnectionCheck | null;
  integrations: IntegrationSettings;
  storage: StorageSettings;
  storageStatus: string;
  onStorageChange: (value: StorageSettings) => void;
  onStorageTest: () => void;
  onStoragePull: () => void;
  onStoragePush: () => void;
  onAiChange: (value: AiConnectionSettings) => void;
  onAiCheck: () => void;
  onOpenOnboarding: () => void;
  onStartFresh: () => void;
  onCheck: () => void;
  onExportIncident: () => void;
}) {
  const aiReady = aiConnection.controlMode !== "in_app" || (aiConnectionCheck?.mode === aiConnection.mode && aiConnectionCheck.status === "ready");
  const providerConnections = status?.providers ?? [
    { role: "primary_enrichment" as const, providerId: integrations.primaryEnrichment.providerId, label: integrations.primaryEnrichment.label, status: "unknown", detail: "Run the connection test to verify this provider." },
    { role: "fallback_enrichment" as const, providerId: integrations.fallbackEnrichment.providerId, label: integrations.fallbackEnrichment.label, status: integrations.fallbackEnrichment.enabled ? "unknown" : "disabled", detail: integrations.fallbackEnrichment.enabled ? "Run the connection test to verify this provider." : "No fallback provider selected." },
    { role: "mailbox" as const, providerId: integrations.mailbox.providerId, label: integrations.mailbox.label, status: "unknown", detail: "Run the connection test to verify this provider." },
  ];
  const mailboxLabel = providerConnections.find((item) => item.role === "mailbox")?.label ?? integrations.mailbox.label;
  const checks = storage.mode === "browser" ? [
    { label: "Browser workspace", detail: "Imports, drafts, preferences, and reports are stored in this browser.", ok: true },
    { label: "Profiles", detail: "At least one writing and sender profile exists.", ok: profiles.length > 0 },
    { label: "Provider actions", detail: "Disabled in browser-only mode. Use an outside AI or connect a backend when needed.", ok: true },
  ] : [
    { label: "Local service", detail: "Stores contact and send history and runs provider connections.", ok: health.status === "ok" },
    { label: "Profiles", detail: "At least one sender and resume profile exists.", ok: profiles.length > 0 },
    { label: `${mailboxLabel} routing`, detail: "Each profile maps to an authorized sender account.", ok: Boolean(status?.profiles.length) && status!.profiles.every((item) => Boolean(item.account)) },
    { label: "Resumes", detail: "Each backend profile has a resume file.", ok: Boolean(status?.profiles.length) && status!.profiles.every((item) => item.resumeConfigured) },
    ...providerConnections.map((item) => ({ label: `${roleLabel(item.role)}: ${item.label}`, detail: item.detail, ok: item.status === "configured" || item.status === "disabled", state: item.status })),
  ];
  return (
    <div className="setup-view">
      <StorageSetup value={storage} onChange={onStorageChange} compact status={storageStatus} onTest={onStorageTest} onPull={onStoragePull} onPush={onStoragePush} />
      <section className="ai-setup">
        <div className="section-heading"><div><span className="eyebrow">AI ownership</span><h3><Sparkles size={16} /> {controlModeLabel(aiConnection.controlMode)}</h3></div><StatusPill state={aiReady ? "ready" : "setup"} label={aiReady ? "configured" : "adapter required"} /></div>
        <label className="field"><span>How AI operates</span><select value={aiConnection.controlMode} onChange={(event) => {
          const controlMode = event.target.value as AiControlMode;
          const mode = controlMode === "templates_only" ? "manual" : controlMode === "in_app" && aiConnection.mode === "manual" ? "codex_cli" : aiConnection.mode;
          onAiChange({ ...aiConnection, controlMode, mode });
        }}><option value="external_operator">Outside AI operates the console</option><option value="in_app">Console invokes an AI</option><option value="templates_only">Templates only</option></select></label>
        {aiConnection.controlMode === "external_operator" ? <div className="ownership-note"><strong>Connections live in the outside AI environment</strong><span>That AI should use this console's MCP plus its own authorized provider connectors. A ChatGPT, Claude, Cursor, or OpenCode subscription can stay signed in there; no model API key belongs in this console.</span><a href="/AI_OPERATOR_GUIDE.md" target="_blank" rel="noreferrer">AI operator guide</a></div> : aiConnection.controlMode === "in_app" ? <InlineAiConfiguration value={aiConnection} check={aiConnectionCheck} onChange={onAiChange} onCheck={onAiCheck} /> : <div className="inline-note">Templates-only mode builds queues and plans without calling an LLM.</div>}
      </section>

      <section className="system-checks">
        <div className="section-heading"><div><span className="eyebrow">Step 2</span><h3>Operational connections</h3></div><div className="setup-heading-actions"><button className="small-button compact" onClick={onOpenOnboarding}><Settings size={14} /> Change</button><button className="small-button compact" onClick={onCheck}><RefreshCw size={14} /> Test</button></div></div>
        {status && <div className={`sample-mode ${status.publicSampleMode ? "active" : ""}`}><strong>{status.publicSampleMode ? "Public sample mode" : "Private operator mode"}</strong><span>{status.publicSampleMode ? "Paid and email providers are locked." : status.liveSendEnabled ? "Live sends are enabled with approval gates." : "Drafting is available; live sends remain disabled."}</span></div>}
        {checks.map((check) => <div className={`setup-check ${check.ok ? "ready" : "missing"}`} key={check.label}><span>{check.ok ? <Check size={15} /> : <AlertTriangle size={15} />}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div><b>{"state" in check ? check.state.replaceAll("-", " ") : check.ok ? "ready" : "needs setup"}</b></div>)}
        <div className="setup-actions"><button className="small-button" onClick={onExportIncident}><HardDriveDownload size={14} /> Download diagnostics</button></div>
      </section>

      <section className="mcp-setup">
        <div className="section-heading"><div><span className="eyebrow">Step 3</span><h3><Terminal size={16} /> Connect an MCP client</h3></div><StatusPill state={health.status === "ok" ? "ready" : "setup"} label={health.status === "ok" ? "backend ready" : "backend offline"} /></div>
        <p>The MCP server uses this same local service. It never receives mailbox passwords or provider keys. Contact details, mailbox content, provider calls, and live sends stay disabled until separately enabled.</p>
        <div className="mcp-command-grid">
          <div><span>Build the standalone server</span><code>npm run build:mcp</code></div>
          <div><span>Run from this checkout</span><code>npm run mcp</code></div>
          <div><span>Backend address</span><code>{backendUrl || "Start with npm run dev:backend"}</code></div>
        </div>
        <details className="mcp-permissions"><summary>Optional MCP permissions</summary><div><code>OUTREACH_MCP_EXPOSE_CONTACTS=1</code><small>Registers tools that return recruiter names and email addresses.</small><code>OUTREACH_MCP_EXPOSE_MAILBOX=1</code><small>Registers tools that return mailbox sender details and previews.</small><code>OUTREACH_MCP_ENABLE_PROVIDER_ACTIONS=1</code><small>Allows confirmed {integrations.primaryEnrichment.label}, {integrations.fallbackEnrichment.enabled ? integrations.fallbackEnrichment.label : "manual fallback"}, and {mailboxLabel} operations.</small><code>OUTREACH_MCP_ENABLE_LIVE_SEND=1</code><small>Unlocks the MCP send gate. The backend live-send lock and exact confirmation are still required.</small></div></details>
        <div className="inline-note"><ShieldAlert size={14} /> A successful {mailboxLabel} provider request is not delivery confirmation. Sent mail, bounces, replies, and the activity log still need reconciliation.</div>
      </section>

      <section className="support-setup">
        <div className="section-heading"><div><span className="eyebrow">Help and maintenance</span><h3><Bug size={16} /> Outreach Console {APP_VERSION}</h3></div></div>
        <p>Use a GitHub ticket for trackable bugs and feature requests. Email is available for private details that should not be posted publicly.</p>
        <div className="support-actions"><a className="small-button" href={BUG_ISSUE_URL} target="_blank" rel="noreferrer"><Github size={15} /> Share a bug</a><a className="small-button" href={SUPPORT_EMAIL_URL}><Mail size={15} /> Email support</a><button className="danger-outline" onClick={onStartFresh}><RotateCcw size={15} /> Start fresh</button></div>
      </section>
    </div>
  );
}

function roleLabel(role: string): string {
  if (role === "primary_enrichment") return "Contact discovery";
  if (role === "fallback_enrichment") return "Fallback discovery";
  return "Email and replies";
}

function CrmView({
  companies,
  detail,
  onSelect,
  onSaveContact,
  onSaveOutreach,
  onToggleSuppression,
}: {
  companies: CrmCompany[];
  detail: CrmCompanyDetail | null;
  onSelect: (id: number) => void;
  onSaveContact: (contact: { name: string; title: string; email: string; source: string; tier: number; confidence: number }) => Promise<void>;
  onSaveOutreach: (entry: { contact_id: number | null; job_id: number | null; profile: string; status: string; subject: string; occurred_at: string }) => Promise<void>;
  onToggleSuppression: () => void;
}) {
  const [crmQuery, setCrmQuery] = useState("");
  const loweredQuery = crmQuery.trim().toLowerCase();
  const visibleCompanies = loweredQuery ? companies.filter((company) => `${company.name} ${company.contacts.map((contact) => `${contact.name} ${contact.email} ${contact.title}`).join(" ")}`.toLowerCase().includes(loweredQuery)) : companies;
  if (!companies.length) return <div className="empty-report">No backend company records yet.</div>;
  return (
    <div className="crm-workspace">
      <div className="searchbox"><Search size={14} /><input aria-label="Search CRM" placeholder="company, contact, email" value={crmQuery} onChange={(event) => setCrmQuery(event.target.value)} /></div>
      <div className="crm-list">
        {visibleCompanies.map((company) => (
          <button className={`crm-company ${company.suppression_reason ? "suppressed" : ""} ${detail?.id === company.id ? "active" : ""}`} key={company.id} onClick={() => onSelect(company.id)}>
            <header><strong>{company.name}</strong><span>{company.job_count} jobs</span></header>
            <small>{company.contact_count} contacts{company.suppression_reason ? " / paused" : ""}</small>
          </button>
        ))}
      </div>
      {detail && (
        <div className="crm-detail">
          <div className="crm-detail-header">
            <div><strong>{detail.name}</strong><small>{detail.jobs.length} jobs / {detail.contacts.length} contacts</small></div>
            <button className="small-button" onClick={onToggleSuppression}>{detail.suppression_reason ? "Resume" : "Pause"}</button>
          </div>
          {detail.suppression_reason && <p className="warning-text">Paused: {detail.suppression_reason}</p>}
          <ContactEditor onSave={onSaveContact} />
          <HistoryEditor detail={detail} onSave={onSaveOutreach} />
          <div className="crm-timeline">
            <strong>Outreach history</strong>
            {detail.outreach.length ? detail.outreach.map((item) => (
              <div key={item.id}>
                <span>{item.status} / {item.contact_name || "unassigned contact"}</span>
                <small>{new Date(item.occurred_at).toLocaleString()} / {item.subject || item.role_title || "no subject"}</small>
              </div>
            )) : <small>No historical outreach recorded.</small>}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactEditor({ onSave }: { onSave: (contact: { name: string; title: string; email: string; source: string; tier: number; confidence: number }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState(1);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim() || !email.includes("@")) return;
    setBusy(true);
    try {
      await onSave({ name, title, email, tier, source: "manual", confidence: 0.9 });
      setName(""); setTitle(""); setEmail("");
    } finally { setBusy(false); }
  }
  return (
    <div className="crm-editor">
      <strong>Add contact</strong>
      <input aria-label="Contact name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <input aria-label="Contact title" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <input aria-label="Contact email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <select aria-label="Contact tier" value={tier} onChange={(event) => setTier(Number(event.target.value))}><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select>
      <button className="small-button" disabled={busy || !name.trim() || !email.includes("@")} onClick={() => void save()}><UserPlus size={14} /> Save</button>
    </div>
  );
}

function HistoryEditor({ detail, onSave }: { detail: CrmCompanyDetail; onSave: (entry: { contact_id: number | null; job_id: number | null; profile: string; status: string; subject: string; occurred_at: string }) => Promise<void> }) {
  const [contactId, setContactId] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("sent");
  const [subject, setSubject] = useState("");
  const [occurredAt, setOccurredAt] = useState(formatLocalInputDate(new Date()));
  return (
    <div className="crm-editor">
      <strong>Record outreach</strong>
      <select aria-label="Historical contact" value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">No contact</option>{detail.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select>
      <select aria-label="Historical job" value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">No job</option>{detail.jobs.map((job) => <option key={job.id} value={job.id}>{job.role_title}</option>)}</select>
      <select aria-label="Historical status" value={status} onChange={(event) => setStatus(event.target.value)}>{["drafted", "scheduled", "sent", "delivered", "replied", "bounced", "rejected", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select>
      <input aria-label="Historical subject" placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
      <input aria-label="Historical date" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
      <button className="small-button" onClick={() => void onSave({ contact_id: contactId ? Number(contactId) : null, job_id: jobId ? Number(jobId) : null, profile: detail.jobs.find((job) => job.id === Number(jobId))?.profile ?? "", status, subject, occurred_at: occurredAt })}><Check size={14} /> Record</button>
    </div>
  );
}

function MailboxView({ events, onDismiss }: { events: MailboxEvent[]; onDismiss: (id: number) => void }) {
  if (!events.length) return <div className="empty-report">No mailbox items need attention.</div>;
  return (
    <div className="mailbox-list">
      {events.map((item) => {
        const actionRequired = item.classification === "interview" || item.classification === "human_reply";
        return <article className={`mailbox-item ${item.classification} ${actionRequired ? "action-required" : ""}`} key={item.id}>
          <header><strong>{item.account.toUpperCase()} / {item.classification.replaceAll("_", " ")}</strong><span>{item.received_at ? new Date(item.received_at).toLocaleDateString() : ""}</span></header>
          {actionRequired && <span className="mailbox-flag">Next step: your attention is required</span>}
          <p>{item.subject}</p>
          <small>{item.company_name || item.sender_email}{item.role_title ? ` / ${item.role_title}` : ""} / proposed: {item.proposed_status}</small>
          <div className="mailbox-actions"><span>{Math.round(item.confidence * 100)}% classification</span><button onClick={() => onDismiss(item.id)}>{actionRequired ? "Mark reviewed" : "Dismiss"}</button></div>
        </article>;
      })}
    </div>
  );
}

function RecoveryView({ exceptions, onResolve }: { exceptions: RecoveryException[]; onResolve: (id: number, resolution: "completed" | "dismissed" | "deferred") => void }) {
  if (!exceptions.length) return <div className="empty-report">No recovery cases.</div>;
  return (
    <div className="recovery-list">
      {exceptions.map((item) => (
        <article className={`recovery-item ${item.severity}`} key={item.id}>
          <header><strong>{item.company_name}</strong><span>{item.type.replaceAll("_", " ")}</span></header>
          <p>{item.proposedAction.kind.replaceAll("_", " ")} -&gt; {item.proposedAction.target}</p>
          {item.proposedAction.consecutiveFailures ? <small>{item.proposedAction.consecutiveFailures} consecutive failures</small> : null}
          {item.state === "open" ? <div className="recovery-actions"><button onClick={() => onResolve(item.id, "completed")}>Complete</button><button onClick={() => onResolve(item.id, "deferred")}>Later</button><button onClick={() => onResolve(item.id, "dismissed")}>Dismiss</button></div> : <small>{item.state}</small>}
        </article>
      ))}
    </div>
  );
}

function JobTableRow({
  job,
  selected,
  contactTarget,
  onToggle,
}: {
  job: JobRow;
  selected: boolean;
  contactTarget: number;
  onToggle: () => void;
}) {
  const state = rowState(job, contactTarget);
  return (
    <button
      className={`job-row ${state} ${selected ? "selected" : ""}`}
      aria-label={`${selected ? "Deselect" : "Select"} ${job.roleTitle || "job"} at ${job.company || "unknown company"}`}
      aria-pressed={selected}
      onClick={onToggle}
    >
      <span className="check-cell">{selected ? <Check size={16} /> : null}</span>
      <span><StatusPill state={state} label={job.status === "unknown" ? stateLabel(state) : job.status.replaceAll("_", " ")} /></span>
      <span className="strong-cell">{job.company || "Unknown"}</span>
      <span>{job.roleTitle || "Missing role"}</span>
      <span>{job.jobId || "-"}</span>
      <span>{job.contactsFound ?? "?"}</span>
      <span>{job.source}</span>
    </button>
  );
}

function JobEditor({
  job,
  profiles,
  onChange,
  onDelete,
}: {
  job: JobRow;
  profiles: ProfileDefinition[];
  onChange: (update: Partial<JobRow>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="job-editor">
      <div className="job-editor-title">
        <div><strong>Edit selected row</strong><span>{job.company || "Unknown company"}</span></div>
        <button className="small-button danger compact" onClick={onDelete}><Trash2 size={14} /> Remove row</button>
      </div>
      <div className="job-editor-grid">
        <label>
          Company
          <input value={job.company} onChange={(event) => onChange({ company: event.target.value })} />
        </label>
        <label>
          Role
          <input value={job.roleTitle} onChange={(event) => onChange({ roleTitle: event.target.value })} />
        </label>
        <label>
          Job ID
          <input value={job.jobId} onChange={(event) => onChange({ jobId: event.target.value })} />
        </label>
        <label>
          Contacts
          <input
            type="number"
            min="0"
            value={job.contactsFound ?? ""}
            onChange={(event) =>
              onChange({ contactsFound: event.target.value === "" ? null : Number(event.target.value) })
            }
          />
        </label>
        <label>
          Profile
          <select value={job.profile} onChange={(event) => onChange({ profile: event.target.value })}>
            {profiles.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={job.status} onChange={(event) => onChange({ status: event.target.value as JobRow["status"] })}>
            <option value="applied">applied</option>
            <option value="application_received">application received</option>
            <option value="drafted">drafted</option>
            <option value="queued">queued</option>
            <option value="sent">sent</option>
            <option value="replied">replied</option>
            <option value="interview">interview</option>
            <option value="rejected">rejected</option>
            <option value="bounced">bounced</option>
            <option value="needs_review">needs review</option>
            <option value="skipped">skipped</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
      </div>
      <label className="wide-field">
        Job URL
        <input value={job.jobUrl} onChange={(event) => onChange({ jobUrl: event.target.value })} />
      </label>
      <label className="wide-field">
        Job description
        <textarea value={job.jobDescription ?? ""} onChange={(event) => onChange({ jobDescription: event.target.value })} />
      </label>
      <label className="wide-field">
        Notes
        <textarea value={job.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>
    </div>
  );
}

function OperationalPanel({
  preflight,
  settings,
  onExportPayload,
  onSelectReady,
}: {
  preflight: PreflightResult;
  settings: BatchSettings;
  onExportPayload: () => void;
  onSelectReady: () => void;
}) {
  return (
    <div className="ops-panel">
      <div className="ops-header">
        <strong>Operational preflight</strong>
        <span>{settings.mode === "backend" ? "backend" : "dry run"}</span>
      </div>
      <div className="ops-grid">
        <Metric label="Ready" value={preflight.readyCount.toString()} />
        <Metric label="Blocked" value={preflight.blockedCount.toString()} />
        <Metric label="Already sent" value={preflight.alreadySentCount.toString()} />
        <Metric label="ETA" value={`${Math.ceil(preflight.estimatedDurationSeconds / 60)}m`} />
      </div>
      <div className="ops-actions">
        <button className="small-button" onClick={onExportPayload}>
          <Download size={15} />
          Export run plan
        </button>
        <button className="small-button" onClick={onSelectReady}>
          <Check size={15} />
          Ready only
        </button>
        <span>{settings.backendUrl || "No backend URL"}</span>
      </div>
      {preflight.warnings.length > 0 && (
        <div className="ops-warnings">
          {preflight.warnings.slice(0, 3).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueView({ preflight }: { preflight: PreflightResult }) {
  if (!preflight.queue.length) return <div className="empty-report">No selected rows in queue.</div>;
  return (
    <div className="queue-list">
      {preflight.queue.map((item) => (
        <article className={`queue-item ${item.status}`} key={item.id}>
          <header>
            <strong>{item.company || "Unknown company"}</strong>
            <span>{item.status}</span>
          </header>
          <p>{item.roleTitle || "Unknown role"}</p>
          <div className="queue-meta">
            <span>{item.jobId || "no id"}</span>
            <span>{item.contactQuality}</span>
          </div>
          {item.blockers.length > 0 && (
            <ul>
              {item.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

function ReportView({
  report,
  history,
  onExportJson,
  onExportCsv,
}: {
  report: BatchReport;
  history: BatchReport[];
  onExportJson: () => void;
  onExportCsv: () => void;
}) {
  return (
    <div className="report">
      <div className="report-summary">
        <span>{report.runId}</span>
        <strong>{report.prepared} prepared</strong>
      </div>
      <div className={`backend-status ${report.backendStatus}`}>
        <span>{report.mode}</span>
        <strong>{report.backendStatus.replace("_", " ")}</strong>
        {report.backendMessage && <p>{report.backendMessage}</p>}
      </div>
      <div className="export-actions">
        <button className="small-button" onClick={onExportJson}>
          <Download size={15} />
          JSON
        </button>
        <button className="small-button" onClick={onExportCsv}>
          <Download size={15} />
          CSV
        </button>
      </div>
      <div className="report-instructions">
        <strong>Batch instructions</strong>
        <p>{report.instructions.emailTemplate || "No template instructions."}</p>
        <p>{report.instructions.targetInstructions || "No targeting rules."}</p>
        <p>{report.instructions.aiInstructions || "No AI quirks."}</p>
      </div>
      <div className="report-stats">
        <span>{report.skipped} skipped</span>
        <span>{report.alreadySent} already sent</span>
        <span>{report.cleanContactGaps} contact flags</span>
      </div>
      <div className="report-items">
        {report.items.map((item) => (
          <article className={`report-item ${item.outcome}`} key={`${item.company}-${item.jobId}`}>
            <header>
              <strong>{item.company}</strong>
              <span>{item.outcome}</span>
            </header>
            <p>{item.roleTitle}</p>
            <ul>
              {item.details.slice(0, 3).map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {history.length > 1 && (
        <div className="history-list">
          <strong>Recent runs</strong>
          {history.slice(1, 5).map((item) => (
            <span key={item.runId}>
              {item.runId}: {item.prepared} prepared / {item.skipped} skipped
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DebugView({
  issues,
  jobs,
  activeProfile,
  settings,
  preflight,
  backendHealth,
}: {
  issues: string[];
  jobs: JobRow[];
  activeProfile: ProfileKey;
  settings: BatchSettings;
  preflight: PreflightResult;
  backendHealth: BackendHealth;
}) {
  const activeRows = jobs.filter((job) => job.profile === activeProfile);
  return (
    <div className="debug-view">
      <div className="debug-grid">
        <Metric label="Imported" value={jobs.length.toString()} />
        <Metric label="Active profile" value={activeRows.length.toString()} />
      </div>
      <div className="issue-list">
        {issues.length ? (
          issues.map((issue) => (
            <div className="issue-row" key={issue}>
              <AlertTriangle size={14} />
              <span>{issue}</span>
            </div>
          ))
        ) : (
          <div className="empty-report">No obvious issues.</div>
        )}
      </div>
      <div className="debug-note">
        <strong>Adapter state</strong>
        <p>
          Mode: {settings.mode}. Backend: {settings.backendUrl || "not configured"}. Queue ready: {preflight.readyCount}.
        </p>
        <p>
          Health: {backendHealth.status}. {backendHealth.message}
        </p>
        {Object.keys(backendHealth.providers).length > 0 && (
          <div className="provider-list">
            {Object.entries(backendHealth.providers).map(([provider, status]) => (
              <span key={provider}>
                {provider}: {status}
              </span>
            ))}
          </div>
        )}
        <p>Real enrichment, mailbox send, and scheduler adapters should run through a private local backend.</p>
      </div>
    </div>
  );
}

function StatusPill({ state, label }: { state: string; label: string }) {
  return <span className={`status-pill ${state}`}>{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="panel-title">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function rowState(job: JobRow, contactTarget: number): string {
  if (job.status === "sent" || job.sentAt) return "sent";
  if (rowNeedsReview(job, contactTarget)) return "needs-review";
  if (isRowRecent(job)) return "recent";
  if (job.status === "queued") return "queued";
  return "pending";
}

function rowNeedsReview(job: JobRow, contactTarget: number): boolean {
  return !job.company || !job.roleTitle || !job.jobUrl || job.profile === "unassigned" || classifyContactQuality(job, contactTarget) !== "clean";
}

function stateLabel(state: string): string {
  if (state === "needs-review") return "review";
  return state;
}

function isRowRecent(job: JobRow): boolean {
  return isRecent(job.lastWorkedAt) || isRecent(job.appliedAt);
}

function sampleJob(
  id: string,
  profile: ProfileKey,
  company: string,
  roleTitle: string,
  jobUrl: string,
  jobId: string,
  status: JobRow["status"],
  contactsFound: number,
  date: string,
  notes: string,
): JobRow {
  return {
    id,
    originalRow: 0,
    profile,
    profileLabel: profileLabel(profile),
    company,
    roleTitle,
    jobDescription: "",
    jobUrl,
    jobId,
    source: "Sample",
    status,
    appliedAt: date,
    lastWorkedAt: date,
    sentAt: status === "sent" ? date : "",
    contactsFound,
    notes,
    importedAt: date,
  };
}

function pickAccent(index: number): string {
  const accents = ["#48d597", "#7dd3fc", "#f0b95e", "#b794f4", "#f16c72", "#9ae6b4"];
  return accents[index % accents.length];
}

function externalStorageKey(storage: StorageSettings): string {
  return `${storage.externalAdapterUrl.replace(/\/+$/, "")}|${storage.externalWorkspaceId}`;
}

function safeBackendUrl(value: string, fallback = DEFAULT_BACKEND_URL): string {
  try {
    return validateHttpEndpoint(value, true);
  } catch {
    return fallback || FALLBACK_BACKEND_URL;
  }
}

function buildIssues(jobs: JobRow[], activeProfile: ProfileKey, contactTarget: number, importWarnings: string[]): string[] {
  const activeRows = jobs.filter((job) => job.profile === activeProfile);
  const issues = [...importWarnings];
  const missingUrl = activeRows.filter((job) => !job.jobUrl).length;
  const missingCompany = activeRows.filter((job) => !job.company).length;
  const missingRole = activeRows.filter((job) => !job.roleTitle).length;
  const contactGaps = activeRows.filter((job) => classifyContactQuality(job, contactTarget) !== "clean").length;
  const unassigned = jobs.filter((job) => job.profile === "unassigned").length;
  const alreadySent = activeRows.filter((job) => job.status === "sent" || job.sentAt).length;
  if (missingUrl) issues.push(`${missingUrl} active-profile rows are missing job URLs.`);
  if (missingCompany) issues.push(`${missingCompany} active-profile rows are missing company names.`);
  if (missingRole) issues.push(`${missingRole} active-profile rows are missing role titles.`);
  if (contactGaps) issues.push(`${contactGaps} active-profile rows are below the clean contact target.`);
  if (unassigned) issues.push(`${unassigned} imported rows have no recognized profile.`);
  if (alreadySent) issues.push(`${alreadySent} active-profile rows already have sent status and will not be selected by the active filter.`);
  return Array.from(new Set(issues));
}
