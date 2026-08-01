import type { DailyQueueState, JobRow, MessageDraft } from "../types";

const terminalStatuses = new Set<JobRow["status"]>(["rejected", "bounced", "skipped"]);

export interface RoutineItem {
  job: JobRow;
  dueAt: string;
  state: "overdue" | "due_today" | "upcoming";
  reason: string;
}

export interface RoutineSummary {
  overdue: RoutineItem[];
  dueToday: RoutineItem[];
  upcoming: RoutineItem[];
  suggestedJobIds: string[];
}

export const emptyDailyQueue = (now = new Date()): DailyQueueState => ({
  version: 1,
  date: localDateKey(now),
  jobIds: [],
  lastDestination: "today",
  updatedAt: "",
});

export function buildRoutineSummary(
  jobs: JobRow[],
  drafts: MessageDraft[],
  followUpDays: number,
  limit: number,
  now = new Date(),
): RoutineSummary {
  const start = startOfLocalDay(now).getTime();
  const end = start + 86_400_000;
  const items = jobs
    .filter((job) => !terminalStatuses.has(job.status) && job.status !== "interview")
    .map((job) => routineItem(job, drafts, followUpDays, start, end))
    .filter((item): item is RoutineItem => item !== null)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const overdue = items.filter((item) => item.state === "overdue");
  const dueToday = items.filter((item) => item.state === "due_today");
  const upcoming = items.filter((item) => item.state === "upcoming");
  return {
    overdue,
    dueToday,
    upcoming,
    suggestedJobIds: [...overdue, ...dueToday, ...upcoming].slice(0, Math.max(1, limit)).map((item) => item.job.id),
  };
}

export function isQueueCurrent(queue: DailyQueueState, now = new Date()): boolean {
  return queue.date === localDateKey(now) && queue.jobIds.length > 0;
}

export function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function routineItem(job: JobRow, drafts: MessageDraft[], followUpDays: number, start: number, end: number): RoutineItem | null {
  const explicit = parseDate(job.followUpDueAt);
  const lastActivity = parseDate(job.sentAt) ?? parseDate(job.lastWorkedAt) ?? parseDate(job.appliedAt) ?? parseDate(job.importedAt);
  if (!explicit && !lastActivity) return null;
  const due = explicit ?? new Date(lastActivity!.getTime() + Math.max(1, followUpDays) * 86_400_000);
  const draft = drafts.some((item) => item.jobRowId === job.id && item.status !== "sent");
  const reason = job.followUpDueAt
    ? "Follow-up date set on the application"
    : draft
      ? "A message is still waiting to be completed"
      : job.sentAt || job.status === "sent"
        ? `No response after ${Math.max(1, followUpDays)} days`
        : `Application has not moved after ${Math.max(1, followUpDays)} days`;
  const timestamp = due.getTime();
  return {
    job,
    dueAt: due.toISOString(),
    state: timestamp < start ? "overdue" : timestamp < end ? "due_today" : "upcoming",
    reason,
  };
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
