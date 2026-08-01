import { describe, expect, it } from "vitest";
import type { JobRow, PreflightResult } from "../types";
import { prepareMessageDrafts } from "./drafts";
import { defaultWritingPreferences } from "./preferences";
import { buildProcessStages, buildWorkflowGuidance } from "./workflow-guide";

const job: JobRow = { id: "job", originalRow: 2, profile: "data_analyst", profileLabel: "DA", company: "Example", roleTitle: "Analyst", jobUrl: "https://example.test/job", jobId: "1", source: "test", status: "applied", appliedAt: "", lastWorkedAt: "", sentAt: "", contactsFound: 0, notes: "", importedAt: "" };
const blocked: PreflightResult = { selectedCount: 1, readyCount: 0, blockedCount: 1, alreadySentCount: 0, estimatedDurationSeconds: 0, warnings: [], queue: [{ id: "job", jobId: "1", company: "Example", roleTitle: "Analyst", profile: "data_analyst", jobUrl: job.jobUrl, status: "blocked", contactQuality: "missing", blockers: ["no clean contacts"] }] };

describe("workflow guide", () => {
  it("turns a contact blocker into a direct next action", () => {
    const input = { allJobs: [job], selectedJobs: [job], drafts: [], preflight: blocked, scheduledCount: 0, mailboxEvents: [], recoveryExceptions: [], connectedServices: false };
    expect(buildWorkflowGuidance(input)).toMatchObject({ nextAction: "Fix contact gaps", nextDestination: "activity" });
    expect(buildProcessStages(input).find((stage) => stage.id === "contacts")?.status).toBe("blocked");
  });

  it("starts with import guidance when the workspace is empty", () => {
    const input = { allJobs: [], selectedJobs: [], drafts: [], preflight: { ...blocked, selectedCount: 0, blockedCount: 0, queue: [] }, scheduledCount: 0, mailboxEvents: [], recoveryExceptions: [], connectedServices: false };
    expect(buildWorkflowGuidance(input).nextAction).toBe("Import an application file");
  });

  it("counts review only when every draft for an application is approved", () => {
    const readyJob = { ...job, contactsFound: 2 };
    const preflight = { ...blocked, readyCount: 1, blockedCount: 0, queue: [{ ...blocked.queue[0], status: "ready" as const, contactQuality: "clean" as const, blockers: [] }] };
    const drafts = prepareMessageDrafts([readyJob], [], 2, { ...defaultWritingPreferences, mode: "manual" }, "Candidate");
    const partial = drafts.map((draft, index) => ({ ...draft, status: index === 0 ? "approved" as const : "ready" as const }));
    const input = { allJobs: [readyJob], selectedJobs: [readyJob], drafts: partial, preflight, scheduledCount: 0, mailboxEvents: [], recoveryExceptions: [], connectedServices: false };
    expect(buildProcessStages(input).find((stage) => stage.id === "drafts")?.count).toBe(2);
    expect(buildProcessStages(input).find((stage) => stage.id === "review")?.count).toBe(1);
    expect(buildProcessStages({ ...input, drafts: partial.map((draft) => ({ ...draft, status: "approved" as const })) }).find((stage) => stage.id === "review")?.count).toBe(2);
  });

  it("treats only unresolved recovery items as response blockers", () => {
    const input = { allJobs: [job], selectedJobs: [job], drafts: [], preflight: blocked, scheduledCount: 0, mailboxEvents: [], recoveryExceptions: [{ id: 1, company_name: "Example", contact_name: null, contact_email: null, type: "redirect", state: "resolved", severity: "low", created_at: "", proposedAction: { kind: "none", target: "" } }], connectedServices: false };
    expect(buildProcessStages(input).find((stage) => stage.id === "responses")?.status).not.toBe("blocked");
    expect(buildProcessStages({ ...input, recoveryExceptions: [{ ...input.recoveryExceptions[0], state: "open" }] }).find((stage) => stage.id === "responses")?.status).toBe("blocked");
  });
});
