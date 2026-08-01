import { describe, expect, it } from "vitest";
import type { JobRow } from "../types";
import { buildRoutineSummary, emptyDailyQueue, isQueueCurrent } from "./routine";

const base: JobRow = {
  id: "one", originalRow: 2, profile: "data_analyst", profileLabel: "DA", company: "Example", roleTitle: "Analyst",
  jobUrl: "https://example.test/job", jobId: "1", source: "test", status: "applied", appliedAt: "2026-07-27T12:00:00Z",
  lastWorkedAt: "", sentAt: "", contactsFound: 1, notes: "", importedAt: "2026-07-27T12:00:00Z",
};

describe("daily routine", () => {
  it("separates overdue, due today, and upcoming follow-ups", () => {
    const now = new Date("2026-07-31T16:00:00Z");
    const result = buildRoutineSummary([
      base,
      { ...base, id: "today", followUpDueAt: "2026-07-31T18:00:00Z" },
      { ...base, id: "later", followUpDueAt: "2026-08-02T18:00:00Z" },
      { ...base, id: "closed", status: "rejected" },
    ], [], 3, 10, now);
    expect(result.overdue.map((item) => item.job.id)).toContain("one");
    expect(result.dueToday.map((item) => item.job.id)).toContain("today");
    expect(result.upcoming.map((item) => item.job.id)).toContain("later");
    expect(result.suggestedJobIds).not.toContain("closed");
  });

  it("recognizes only today's persisted queue", () => {
    const now = new Date("2026-07-31T16:00:00Z");
    const queue = { ...emptyDailyQueue(now), jobIds: ["one"] };
    expect(isQueueCurrent(queue, now)).toBe(true);
    expect(isQueueCurrent({ ...queue, date: "2026-07-30" }, now)).toBe(false);
  });
});
