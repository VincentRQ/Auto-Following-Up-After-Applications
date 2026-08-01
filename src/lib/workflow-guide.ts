import type { JobRow, MailboxEvent, MessageDraft, PreflightResult, RecoveryException } from "../types";

export type ProcessStageId = "applications" | "contacts" | "drafts" | "review" | "scheduled" | "sent" | "responses";
export type ProcessDestination = "today" | "jobs" | "writing" | "activity" | "settings";

export interface ProcessStage {
  id: ProcessStageId;
  label: string;
  count: number;
  status: "complete" | "current" | "blocked" | "upcoming";
  action: string;
  destination: ProcessDestination;
  detail: string;
}

export interface WorkflowGuidance {
  location: string;
  nextAction: string;
  nextDestination: ProcessDestination;
  clickResult: string;
  automated: string;
  manual: string;
  blocker: string;
  fix: string;
}

interface WorkflowGuideInput {
  allJobs: JobRow[];
  selectedJobs: JobRow[];
  drafts: MessageDraft[];
  preflight: PreflightResult;
  scheduledCount: number;
  mailboxEvents: MailboxEvent[];
  recoveryExceptions: RecoveryException[];
  connectedServices: boolean;
}

export function buildProcessStages(input: WorkflowGuideInput): ProcessStage[] {
  const selected = new Set(input.selectedJobs.map((job) => job.id));
  const selectedDrafts = input.drafts.filter((draft) => selected.has(draft.jobRowId));
  const draftJobs = uniqueJobs(selectedDrafts);
  const fullyReviewedJobs = new Set([...selected].filter((jobId) => {
    const jobDrafts = selectedDrafts.filter((draft) => draft.jobRowId === jobId);
    return jobDrafts.length > 0 && jobDrafts.every((draft) => draft.status === "approved" || draft.status === "sent");
  })).size;
  const reviewedDrafts = selectedDrafts.filter((draft) => draft.status === "approved" || draft.status === "sent").length;
  const sent = input.selectedJobs.filter((job) => job.status === "sent" || Boolean(job.sentAt)).length;
  const responses = input.selectedJobs.filter((job) => ["replied", "rejected", "interview", "bounced"].includes(job.status)).length
    + input.mailboxEvents.filter((event) => event.state === "attention").length;
  const stages: Array<Omit<ProcessStage, "status"> & { complete: boolean; blocked?: boolean }> = [
    { id: "applications", label: "Applications", count: input.selectedJobs.length, complete: input.selectedJobs.length > 0, action: input.allJobs.length ? "Select applications" : "Import applications", destination: "jobs", detail: "Applications chosen for this batch." },
    { id: "contacts", label: "Contacts", count: input.preflight.queue.filter((item) => item.contactQuality !== "missing").length, complete: input.selectedJobs.length > 0 && input.preflight.blockedCount === 0, blocked: input.preflight.blockedCount > 0, action: input.preflight.blockedCount ? "Fix contact gaps" : "Review contacts", destination: "activity", detail: "Applications with at least one known direct contact." },
    { id: "drafts", label: "Drafts", count: selectedDrafts.length, complete: input.selectedJobs.length > 0 && draftJobs >= input.preflight.readyCount, action: "Prepare messages", destination: "writing", detail: "Recipient-level message drafts prepared." },
    { id: "review", label: "Review", count: reviewedDrafts, complete: selectedDrafts.length > 0 && fullyReviewedJobs >= input.preflight.readyCount && selectedDrafts.every((draft) => draft.status === "approved" || draft.status === "sent"), action: "Review messages", destination: "writing", detail: "Recipient-level messages approved." },
    { id: "scheduled", label: "Scheduled", count: input.scheduledCount, complete: input.scheduledCount > 0, action: "Set schedule", destination: "jobs", detail: "Messages waiting for their scheduled time." },
    { id: "sent", label: "Sent", count: sent, complete: input.selectedJobs.length > 0 && sent >= input.selectedJobs.length, action: "View activity", destination: "activity", detail: "Selected applications with recorded outreach." },
    { id: "responses", label: "Responses", count: responses, complete: responses > 0, blocked: input.recoveryExceptions.some((item) => !["resolved", "dismissed"].includes(item.state)), action: "Handle responses", destination: "activity", detail: "Replies, interviews, rejections, bounces, and redirects." },
  ];
  const firstIncomplete = stages.findIndex((stage) => !stage.complete || stage.blocked);
  return stages.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    count: stage.count,
    status: stage.blocked ? "blocked" : stage.complete ? "complete" : index === firstIncomplete ? "current" : "upcoming",
    action: stage.action,
    destination: stage.destination,
    detail: stage.detail,
  }));
}

export function buildWorkflowGuidance(input: WorkflowGuideInput): WorkflowGuidance {
  if (!input.allJobs.length) return guidance("No applications imported yet", "Import an application file", "jobs", "The import screen will show the required columns and validate the file before adding anything.", input, "There is no application data to work from.", "Import CSV/XLSX or add one application manually.");
  if (!input.selectedJobs.length) return guidance("Applications are available, but no batch is selected", "Select applications", "jobs", "The Applications screen will open so you can choose the jobs to work on.", input, "Nothing is selected for the next batch.", "Select ready applications or resume today's saved queue.");
  if (input.preflight.blockedCount) return guidance("Contact discovery", "Fix contact gaps", "activity", "Problems and redirects will open with a corrective action for every blocked company.", input, `${input.preflight.blockedCount} selected application${input.preflight.blockedCount === 1 ? " is" : "s are"} blocked.`, "Find contacts with a tested provider, enter contacts manually, or remove the application from this batch.");
  const selected = new Set(input.selectedJobs.map((job) => job.id));
  const selectedDrafts = input.drafts.filter((draft) => selected.has(draft.jobRowId));
  if (!selectedDrafts.length) return guidance("Contacts are ready", "Prepare messages", "writing", "The Messages screen will create one draft per known contact. It will not invent placeholder contacts.", input, "No messages have been prepared for this batch.", "Prepare messages, then review each recipient and body.");
  const needsReview = selectedDrafts.filter((draft) => draft.status !== "approved" && draft.status !== "sent").length;
  if (needsReview) return guidance("Message review", `Review ${needsReview} message${needsReview === 1 ? "" : "s"}`, "writing", "The Messages screen will open at the drafts that still need a recipient, writing, or approval.", input, `${needsReview} message${needsReview === 1 ? " is" : "s are"} not approved.`, "Complete missing fields and approve each message before connected sending.");
  if (input.scheduledCount) return guidance("Messages are scheduled", "Review the schedule", "jobs", "The batch controls will show the exact scheduled time and number of messages.", input, "", "You can leave the schedule in place or cancel it before it starts.");
  return guidance("Ready to schedule", "Choose when to run", "jobs", "The batch controls will explain whether the click runs a dry check or schedules the connected workflow.", input, "", "Choose Run dry check now or schedule the approved messages.");
}

function guidance(location: string, nextAction: string, nextDestination: ProcessDestination, clickResult: string, input: WorkflowGuideInput, blocker: string, fix: string): WorkflowGuidance {
  return {
    location,
    nextAction,
    nextDestination,
    clickResult,
    automated: input.connectedServices ? "Connected services can discover contacts, prepare drafts, schedule approved work, and monitor replies after their individual tests pass." : "The console validates imports, tracks stages, prepares templates, saves the daily queue, and records your work locally.",
    manual: input.connectedServices ? "You still review facts, recipients, attachments, and any action that sends or responds." : "You enter contacts, move messages to your email service, send them, and record responses unless you connect those services.",
    blocker,
    fix,
  };
}

function uniqueJobs(drafts: MessageDraft[]): number {
  return new Set(drafts.map((draft) => draft.jobRowId)).size;
}
