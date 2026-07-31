import { describe, expect, it } from "vitest";
import type { JobRow } from "../types";
import { applyGeneratedMessages, buildLlmWritingBrief, prepareMessageDrafts, renderMessageTemplate, updateMessageDraft, wordCount } from "./drafts";
import { defaultWritingPreferences } from "./preferences";

const job: JobRow = {
  id: "row-1",
  originalRow: 2,
  profile: "data_analyst",
  profileLabel: "Data Analyst",
  company: "Example Analytics",
  roleTitle: "Reporting Analyst",
  jobDescription: "Build weekly KPI reporting for operational leaders.",
  jobUrl: "https://example.test/jobs/1",
  jobId: "REQ-1",
  source: "direct",
  status: "applied",
  appliedAt: "2026-07-01",
  lastWorkedAt: "",
  sentAt: "",
  contactsFound: 0,
  notes: "",
  importedAt: "2026-07-01",
};

describe("message drafts", () => {
  it("creates one independent slot per desired contact", () => {
    const drafts = prepareMessageDrafts([job], [], 3, { ...defaultWritingPreferences, mode: "manual" }, "Jordan");
    expect(drafts).toHaveLength(3);
    expect(new Set(drafts.map((item) => item.id)).size).toBe(3);
    expect(drafts.every((item) => item.status === "needs_writing")).toBe(true);
  });

  it("renders templates and updates readiness after a recipient is supplied", () => {
    const writing = { ...defaultWritingPreferences, mode: "template" as const };
    const focus = "SQL analysis, dashboard reporting, and data quality";
    const [draft] = prepareMessageDrafts([job], [], 1, writing, "Jordan", focus);
    const updated = updateMessageDraft(draft, { recipientName: "Alex Smith", recipientEmail: "alex@example.test" }, writing, job, "Jordan", focus);
    expect(updated.body).toContain("Hi Alex");
    expect(updated.body).toContain("weekly KPI reporting");
    expect(updated.body).toContain(focus);
    expect(wordCount(updated.body)).toBeLessThanOrEqual(80);
    expect(updated.status).toBe("ready");
  });

  it("keeps over-limit copy in writing review", () => {
    const writing = { ...defaultWritingPreferences, mode: "manual" as const, maximumWords: 20 };
    const [draft] = prepareMessageDrafts([job], [], 1, writing, "Jordan");
    const updated = updateMessageDraft(draft, {
      recipientName: "Alex Smith",
      recipientEmail: "alex@example.test",
      subject: "Reporting Analyst",
      body: Array.from({ length: 21 }, () => "word").join(" "),
    }, writing, job, "Jordan");
    expect(updated.status).toBe("needs_writing");
  });

  it("retains explicit approval only while the message remains complete", () => {
    const writing = { ...defaultWritingPreferences, mode: "template" as const };
    const [draft] = prepareMessageDrafts([job], [], 1, writing, "Jordan");
    const ready = updateMessageDraft(draft, { recipientName: "Alex Smith", recipientEmail: "alex@example.test" }, writing, job, "Jordan");
    const approved = updateMessageDraft(ready, { status: "approved" }, writing, job, "Jordan");
    expect(approved.status).toBe("approved");

    const invalidated = updateMessageDraft(approved, { body: "" }, writing, job, "Jordan");
    expect(invalidated.status).toBe("needs_writing");
  });

  it("builds a structured outside-LLM handoff and safely applies results", () => {
    const [draft] = prepareMessageDrafts([job], [], 1, defaultWritingPreferences, "Jordan");
    const brief = buildLlmWritingBrief([draft], defaultWritingPreferences, [{ key: "data_analyst", label: "Data Analyst", senderName: "Jordan" }]);
    expect(brief).toContain('"draft_id": "row-1::1"');
    const [updated] = applyGeneratedMessages([draft], [{ draft_id: draft.id, subject: "Reporting Analyst", body: "Hello there." }], defaultWritingPreferences);
    expect(updated.subject).toBe("Reporting Analyst");
    expect(wordCount(updated.body)).toBe(2);
  });

  it("leaves unknown placeholders blank", () => {
    expect(renderMessageTemplate("{{known}}/{{unknown}}", { known: "yes" })).toBe("yes/");
  });
});
