import { describe, expect, it } from "vitest";
import type { JobRow } from "../types";
import { buildCalendarEvents, buildCalendarIcs, defaultCalendarPreferences, normalizeCalendarPreferences, selectCalendarEvents } from "./calendar";

const jobs: JobRow[] = [
  {
    id: "job-1",
    originalRow: 2,
    profile: "analyst",
    profileLabel: "Analyst",
    company: "Example Co",
    roleTitle: "Reporting Analyst",
    jobUrl: "https://jobs.example.test/123",
    jobId: "123",
    source: "Manual entry",
    status: "interview",
    statusDetail: "Interview scheduled for August 4, 2026",
    appliedAt: "2026-07-31T14:00:00.000Z",
    lastWorkedAt: "2026-08-01T09:00:00.000Z",
    sentAt: "2026-08-01T12:00:00.000Z",
    contactsFound: 3,
    notes: "",
    importedAt: "2026-07-31T14:00:00.000Z",
  },
];

describe("calendar export", () => {
  it("builds application, outreach, and status events from one job", () => {
    const events = buildCalendarEvents(jobs);
    expect(events.map((event) => [event.kind, event.date])).toEqual([
      ["application", "2026-07-31"],
      ["outreach", "2026-08-01"],
      ["interview", "2026-08-04"],
    ]);
  });

  it("uses low-noise defaults and limits export to the visible month", () => {
    const events = buildCalendarEvents(jobs);
    expect(selectCalendarEvents(events, defaultCalendarPreferences, "2026-08").map((event) => event.kind)).toEqual(["interview"]);
  });

  it("creates a portable calendar file without reminders by default", () => {
    const events = selectCalendarEvents(buildCalendarEvents(jobs), defaultCalendarPreferences, "2026-08");
    const output = buildCalendarIcs(events, defaultCalendarPreferences, new Date("2026-07-31T12:00:00.000Z"));
    expect(output).toContain("BEGIN:VCALENDAR\r\n");
    expect(output).toContain("DTSTART;VALUE=DATE:20260804");
    expect(output).toContain("SUMMARY:Interview: Example Co");
    expect(output).toContain("Job: https://jobs.example.test/123");
    expect(output).not.toContain("BEGIN:VALARM");
  });

  it("adds one alert only when the user selects one", () => {
    const preferences = { ...defaultCalendarPreferences, reminderMinutes: 30 as const };
    const output = buildCalendarIcs(selectCalendarEvents(buildCalendarEvents(jobs), preferences, "2026-08"), preferences, new Date("2026-07-31T12:00:00.000Z"));
    expect(output).toContain("TRIGGER:-PT30M");
  });

  it("normalizes incomplete or invalid saved calendar settings", () => {
    expect(normalizeCalendarPreferences({
      destination: "outlook",
      reminderMinutes: 60,
      includedKinds: { ...defaultCalendarPreferences.includedKinds, application: true },
    })).toMatchObject({
      destination: "outlook",
      exportScope: "visible_month",
      reminderMinutes: 60,
      includedKinds: { application: true, interview: true, reply: true },
    });

    expect(normalizeCalendarPreferences({
      destination: "invalid" as never,
      reminderMinutes: 99 as never,
      includedKinds: { interview: false } as never,
    })).toEqual({
      ...defaultCalendarPreferences,
      includedKinds: { ...defaultCalendarPreferences.includedKinds, interview: false },
    });
  });
});
