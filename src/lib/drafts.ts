import type { JobRow, MessageDraft, WritingPreferences } from "../types";

const placeholderPattern = /\{\{([a-z0-9_]+)\}\}/gi;

export function prepareMessageDrafts(
  jobs: JobRow[],
  existing: MessageDraft[],
  contactTarget: number,
  writing: WritingPreferences,
  senderName = "",
  profileFocus = "relevant work in the field",
): MessageDraft[] {
  const existingById = new Map(existing.map((draft) => [draft.id, draft]));
  const next: MessageDraft[] = [];
  for (const job of jobs) {
    const knownContacts = Math.max(0, job.contactsFound ?? 0);
    const completedExisting = existing.filter((draft) => draft.jobRowId === job.id && draft.recipientEmail.includes("@")).length;
    const desiredSlots = Math.min(Math.max(1, contactTarget), Math.max(knownContacts, completedExisting));
    for (let slot = 1; slot <= desiredSlots; slot += 1) {
      const id = `${job.id}::${slot}`;
      const saved = existingById.get(id);
      if (saved) {
        next.push({ ...saved, company: job.company, roleTitle: job.roleTitle, jobId: job.jobId, jobUrl: job.jobUrl, profile: job.profile });
        continue;
      }
      const values = templateValues(job, senderName, "", "", profileFocus);
      const subject = renderMessageTemplate(writing.subjectTemplate, values);
      const body = writing.mode === "template" ? renderMessageTemplate(writing.bodyTemplate, values) : "";
      next.push({
        id,
        jobRowId: job.id,
        slot,
        profile: job.profile,
        company: job.company,
        roleTitle: job.roleTitle,
        jobId: job.jobId,
        jobUrl: job.jobUrl,
        recipientName: "",
        recipientEmail: "",
        recipientTitle: "",
        mode: writing.mode,
        subject,
        body,
        promptOverride: "",
        status: body.trim() ? "needs_recipient" : "needs_writing",
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return next;
}

export function updateMessageDraft(
  draft: MessageDraft,
  update: Partial<MessageDraft>,
  writing: WritingPreferences,
  job?: JobRow,
  senderName = "",
  profileFocus = "relevant work in the field",
): MessageDraft {
  const merged = { ...draft, ...update, updatedAt: new Date().toISOString() };
  if (merged.mode === "template" && job && (update.mode !== undefined || update.recipientName !== undefined || update.recipientTitle !== undefined)) {
    const values = templateValues(job, senderName, merged.recipientName, merged.recipientTitle, profileFocus);
    merged.subject = renderMessageTemplate(writing.subjectTemplate, values);
    merged.body = renderMessageTemplate(writing.bodyTemplate, values);
  }
  const calculatedStatus = draftStatus(merged, writing);
  merged.status = update.status === "approved" && calculatedStatus !== "needs_recipient" && calculatedStatus !== "needs_writing"
    ? "approved"
    : calculatedStatus;
  return merged;
}

export function buildLlmWritingBrief(
  drafts: MessageDraft[],
  writing: WritingPreferences,
  profiles: Array<{ key: string; label: string; senderName: string; notes?: string }>,
): string {
  const profileByKey = new Map(profiles.map((profile) => [profile.key, profile]));
  const messages = drafts.map((draft) => {
    const profile = profileByKey.get(draft.profile);
    return {
      draft_id: draft.id,
      profile: profile?.label ?? draft.profile,
      sender_name: profile?.senderName ?? "",
      profile_notes: profile?.notes ?? "",
      company: draft.company,
      role_title: draft.roleTitle,
      position_id: draft.jobId,
      job_url: draft.jobUrl,
      recipient_name: draft.recipientName,
      recipient_title: draft.recipientTitle,
      recipient_email: draft.recipientEmail,
      current_subject: draft.subject,
      current_body: draft.body,
      specific_instructions: draft.promptOverride,
    };
  });
  return [
    "Prepare individualized recruiter follow-up messages for Outreach Console.",
    `Global instructions: ${writing.globalPrompt}`,
    `Maximum body length: ${writing.maximumWords} words.`,
    "Use only the supplied facts. Return JSON as an array of objects with draft_id, subject, and body. Do not add commentary.",
    JSON.stringify(messages, null, 2),
  ].join("\n\n");
}

export function applyGeneratedMessages(
  drafts: MessageDraft[],
  generated: Array<{ draft_id?: string; id?: string; subject?: string; body?: string }>,
  writing: WritingPreferences,
): MessageDraft[] {
  const updates = new Map(generated.map((item) => [String(item.draft_id ?? item.id ?? ""), item]));
  return drafts.map((draft) => {
    const update = updates.get(draft.id);
    if (!update) return draft;
    return updateMessageDraft(draft, {
      subject: String(update.subject ?? draft.subject).slice(0, 500),
      body: String(update.body ?? draft.body).slice(0, 20_000),
    }, writing);
  });
}

export function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function renderMessageTemplate(template: string, values: Record<string, string>): string {
  return template.replace(placeholderPattern, (_match, key: string) => values[key.toLowerCase()] ?? "");
}

function templateValues(job: JobRow, senderName: string, recipientName: string, recipientTitle: string, profileFocus: string): Record<string, string> {
  const responsibility = firstResponsibility(job.jobDescription ?? "");
  return {
    company: job.company,
    role_title: job.roleTitle,
    job_id: job.jobId,
    job_url: job.jobUrl,
    source: job.source,
    responsibility: responsibility || "the role's reporting and analysis priorities",
    profile_focus: profileFocus,
    sender_name: senderName,
    recipient_name: recipientName,
    recipient_first_name: recipientName.trim().split(/\s+/)[0] ?? "",
    recipient_title: recipientTitle,
  };
}

function firstResponsibility(description: string): string {
  const line = description
    .split(/\r?\n|[.!?]\s+/)
    .map((item) => item.replace(/^[-*\u2022\s]+/, "").trim())
    .find((item) => item.length >= 20);
  if (!line) return "";
  return line.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 10).join(" ").slice(0, 120);
}

function draftStatus(draft: MessageDraft, writing: WritingPreferences): MessageDraft["status"] {
  if (!draft.recipientEmail.includes("@") || !draft.recipientName.trim()) return "needs_recipient";
  if (!draft.subject.trim() || !draft.body.trim()) return "needs_writing";
  if (wordCount(draft.body) > writing.maximumWords) return "needs_writing";
  return writing.requireIndividualReview ? "ready" : "approved";
}
