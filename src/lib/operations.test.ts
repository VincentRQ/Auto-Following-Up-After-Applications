import { describe, expect, it } from "vitest";
import type { BatchSettings, JobRow } from "../types";
import { buildBackendPayload, buildPreflight, validateHttpEndpoint } from "./operations";

const settings: BatchSettings = {
  profile: "data_analyst",
  scheduledAt: "2026-07-10T15:00",
  spacingSeconds: 30,
  contactTarget: 3,
  selectedIds: ["ready", "blocked", "sent"],
  mode: "backend",
  backendUrl: "http://127.0.0.1:8787",
  instructions: {
    emailTemplate: "Template",
    targetInstructions: "Target recruiters",
    aiInstructions: "Write naturally",
  },
};

const baseJob: JobRow = {
  id: "ready",
  originalRow: 2,
  profile: "data_analyst",
  profileLabel: "DA",
  company: "Acme",
  roleTitle: "Data Analyst",
  jobUrl: "https://example.com/jobs/da",
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

describe("operations", () => {
  it("builds preflight counts", () => {
    const preflight = buildPreflight(
      [
        baseJob,
        { ...baseJob, id: "blocked", company: "", contactsFound: 0 },
        { ...baseJob, id: "sent", status: "sent", sentAt: "2026-07-10T10:00:00Z" },
      ],
      settings,
    );
    expect(preflight.readyCount).toBe(1);
    expect(preflight.blockedCount).toBe(1);
    expect(preflight.alreadySentCount).toBe(1);
  });

  it("only includes ready jobs in backend payload", () => {
    const payload = buildBackendPayload(
      [
        baseJob,
        { ...baseJob, id: "blocked", company: "", contactsFound: 0 },
      ],
      settings,
    );
    expect(payload.queue).toHaveLength(1);
    expect(payload.queue[0].job_id).toBe("REQ-1");
  });

  it("accepts secure adapter URLs and restricts the local backend to loopback", () => {
    expect(validateHttpEndpoint("http://127.0.0.1:43128/", false)).toBe("http://127.0.0.1:43128");
    expect(validateHttpEndpoint("https://adapter.example/v1/", false)).toBe("https://adapter.example/v1");
    expect(() => validateHttpEndpoint("http://adapter.example", false)).toThrow(/require HTTPS/i);
    expect(() => validateHttpEndpoint("https://backend.example", true)).toThrow(/loopback/i);
    expect(() => validateHttpEndpoint("https://user:secret@adapter.example", false)).toThrow(/credentials/i);
  });
});
