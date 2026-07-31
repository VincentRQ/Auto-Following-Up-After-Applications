import type { CalendarEventKind, CalendarPreferences, JobRow } from "../types";

export interface CalendarEvent {
  id: string;
  date: string;
  kind: CalendarEventKind;
  label: string;
  company: string;
  jobUrl: string;
}

export const calendarEventKinds: CalendarEventKind[] = [
  "application",
  "outreach",
  "interview",
  "reply",
  "rejection",
  "bounce",
  "confirmation",
];

export const defaultCalendarPreferences: CalendarPreferences = {
  version: 1,
  destination: "google",
  exportScope: "visible_month",
  reminderMinutes: 0,
  includedKinds: {
    application: false,
    outreach: false,
    interview: true,
    reply: true,
    rejection: false,
    bounce: false,
    confirmation: false,
  },
};

export function normalizeCalendarPreferences(value: Partial<CalendarPreferences> | undefined): CalendarPreferences {
  const requestedKinds = { ...defaultCalendarPreferences.includedKinds, ...(value?.includedKinds ?? {}) };
  const includedKinds = Object.fromEntries(calendarEventKinds.map((kind) => [kind, requestedKinds[kind] === true])) as CalendarPreferences["includedKinds"];
  return {
    version: 1,
    destination: ["google", "outlook", "apple", "other"].includes(value?.destination ?? "") ? value!.destination! : defaultCalendarPreferences.destination,
    exportScope: value?.exportScope === "all_events" ? "all_events" : "visible_month",
    reminderMinutes: ([0, 10, 30, 60, 1440] as const).includes(value?.reminderMinutes ?? 0) ? value!.reminderMinutes! : 0,
    includedKinds,
  };
}

export function buildCalendarEvents(jobs: JobRow[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const job of jobs) {
    const applicationDate = toDateKey(job.appliedAt);
    const label = job.roleTitle || job.jobId || "Application";
    const common = { label, company: job.company || "Unknown", jobUrl: job.jobUrl || "" };
    if (applicationDate) events.push({ id: `${job.id}-application`, date: applicationDate, kind: "application", ...common });

    const outreachDate = toDateKey(job.sentAt) || (job.status === "sent" ? applicationDate : "");
    if (outreachDate) events.push({ id: `${job.id}-outreach`, date: outreachDate, kind: "outreach", ...common });

    const statusKinds: Partial<Record<JobRow["status"], CalendarEventKind>> = {
      interview: "interview",
      replied: "reply",
      rejected: "rejection",
      bounced: "bounce",
      application_received: "confirmation",
    };
    const kind = statusKinds[job.status];
    if (!kind) continue;
    const statusDate = findStatusDate(job.statusDetail ?? "", applicationDate) || toDateKey(job.lastWorkedAt) || applicationDate;
    if (statusDate) events.push({ id: `${job.id}-${kind}`, date: statusDate, kind, label: job.statusDetail || label, company: common.company, jobUrl: common.jobUrl });
  }
  return events;
}

export function selectCalendarEvents(events: CalendarEvent[], preferences: CalendarPreferences, visibleMonth: string): CalendarEvent[] {
  return events
    .filter((event) => preferences.includedKinds[event.kind])
    .filter((event) => preferences.exportScope === "all_events" || event.date.startsWith(visibleMonth))
    .sort((left, right) => left.date.localeCompare(right.date) || left.company.localeCompare(right.company) || left.id.localeCompare(right.id));
}

export function buildCalendarIcs(events: CalendarEvent[], preferences: CalendarPreferences, generatedAt = new Date()): string {
  const timestamp = toUtcStamp(generatedAt);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Outreach Console//Application Timeline//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Job Search Follow-up",
  ];

  for (const event of events) {
    const title = `${kindLabel(event.kind)}: ${event.company}`;
    const description = [event.label, event.jobUrl ? `Job: ${event.jobUrl}` : ""].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(event.id)}@outreach-console.local`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${event.date.replaceAll("-", "")}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `CATEGORIES:${escapeIcsText(kindLabel(event.kind))}`,
      "TRANSP:TRANSPARENT",
    );
    if (preferences.reminderMinutes > 0) {
      lines.push(
        "BEGIN:VALARM",
        `TRIGGER:${preferences.reminderMinutes === 1440 ? "-P1D" : `-PT${preferences.reminderMinutes}M`}`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcsText(title)}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function findStatusDate(detail: string, fallbackDate: string): string {
  const full = detail.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (full) {
    const year = full[3].length === 2 ? `20${full[3]}` : full[3];
    return `${year}-${full[1].padStart(2, "0")}-${full[2].padStart(2, "0")}`;
  }
  const short = detail.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (short && fallbackDate) return `${fallbackDate.slice(0, 4)}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
  const named = detail.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i);
  if (named) {
    const year = named[3] || fallbackDate.slice(0, 4);
    const parsed = new Date(`${named[1]} ${named[2]}, ${year} 12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return toDateKey(parsed.toISOString());
  }
  return "";
}

export function toDateKey(value: string): string {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function kindLabel(kind: CalendarEventKind): string {
  const labels: Record<CalendarEventKind, string> = {
    application: "Application",
    outreach: "Outreach",
    interview: "Interview",
    reply: "Reply or next step",
    rejection: "Rejection",
    bounce: "Email problem",
    confirmation: "Application confirmation",
  };
  return labels[kind];
}

function escapeIcsText(value: string): string {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\r\n", "\\n").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function toUtcStamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
