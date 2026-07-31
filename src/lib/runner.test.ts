import { describe, expect, it } from "vitest";
import type { JobRow } from "../types";
import { buildBatchReport, classifyContactQuality } from "./runner";

const baseJob: JobRow = {
  id: "1",
  originalRow: 2,
  profile: "data_analyst",
  profileLabel: "DA",
  company: "Acme",
  roleTitle: "Data Analyst",
  jobUrl: "https://example.com",
  jobId: "REQ-1",
  source: "Hiring Cafe",
  status: "applied",
  appliedAt: "",
  lastWorkedAt: "",
  sentAt: "",
  contactsFound: 3,
  notes: "",
  importedAt: "",
};

describe("runner", () => {
  it("classifies contact quality", () => {
    expect(classifyContactQuality(baseJob, 3)).toBe("clean");
    expect(classifyContactQuality({ ...baseJob, contactsFound: 1 }, 3)).toBe("thin");
    expect(classifyContactQuality({ ...baseJob, contactsFound: 0 }, 3)).toBe("missing");
  });

  it("builds a report for selected jobs", () => {
    const report = buildBatchReport([baseJob], {
      profile: "data_analyst",
      scheduledAt: "2026-07-10T14:00",
      spacingSeconds: 30,
      contactTarget: 3,
      selectedIds: ["1"],
      instructions: {
        emailTemplate: "",
        targetInstructions: "",
        aiInstructions: "",
      },
      mode: "dry_run",
      backendUrl: "",
    });
    expect(report.totalSelected).toBe(1);
    expect(report.prepared).toBe(1);
    expect(report.items[0].details).toContain("Position ID: REQ-1");
  });
});
