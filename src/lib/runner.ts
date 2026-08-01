import type { BatchReport, BatchSettings, ContactQuality, JobRow, ReportItem } from "../types";

export function buildBatchReport(jobs: JobRow[], settings: BatchSettings): BatchReport {
  const selected = jobs.filter((job) => settings.selectedIds.includes(job.id));
  const items = selected.map((job) => buildReportItem(job, settings.contactTarget));
  return {
    runId: `run-${Date.now().toString(36)}`,
    profile: settings.profile,
    createdAt: new Date().toISOString(),
    scheduledAt: settings.scheduledAt,
    instructions: settings.instructions,
    mode: settings.mode,
    backendUrl: settings.backendUrl,
    backendStatus: "not_used",
    backendMessage: "",
    totalSelected: selected.length,
    prepared: items.filter((item) => item.outcome === "prepared").length,
    alreadySent: items.filter((item) => item.outcome === "already_sent").length,
    skipped: items.filter((item) => item.outcome === "skipped").length,
    cleanContactGaps: items.filter((item) => item.contactQuality !== "clean").length,
    items,
  };
}

export function classifyContactQuality(job: JobRow, contactTarget: number): ContactQuality {
  const notes = job.notes.toLowerCase();
  if (notes.includes("no clean") || notes.includes("no usable") || notes.includes("not found")) return "missing";
  if (job.contactsFound === null) return "missing";
  if (job.contactsFound <= 0) return "missing";
  if (job.contactsFound < contactTarget) return "thin";
  return "clean";
}

function buildReportItem(job: JobRow, contactTarget: number): ReportItem {
  const contactQuality = classifyContactQuality(job, contactTarget);
  const details = collectDetails(job, contactQuality, contactTarget);
  if (job.status === "sent" || job.sentAt) {
    return {
      jobId: job.jobId,
      company: job.company,
      roleTitle: job.roleTitle,
      outcome: "already_sent",
      contactQuality,
      details: ["Outreach already marked sent", ...details],
    };
  }
  if (!job.company || !job.roleTitle || !job.jobUrl || job.profile === "unassigned" || contactQuality === "missing") {
    return {
      jobId: job.jobId,
      company: job.company || "Unknown company",
      roleTitle: job.roleTitle || "Unknown role",
      outcome: "skipped",
      contactQuality,
      details: [contactQuality === "missing" ? "Contact discovery or manual contact entry is required" : "Missing required company, role, URL, or profile", ...details],
    };
  }
  return {
    jobId: job.jobId,
    company: job.company,
    roleTitle: job.roleTitle,
    outcome: "prepared",
    contactQuality,
    details,
  };
}

function collectDetails(job: JobRow, contactQuality: ContactQuality, contactTarget: number): string[] {
  const details: string[] = [];
  if (contactQuality === "missing") {
    details.push("No clean direct recruiting contacts found");
  } else if (contactQuality === "thin") {
    details.push(`Below preferred ${contactTarget}-contact target`);
  } else {
    details.push("Clean contact target met");
  }
  if (job.jobId) details.push(`Position ID: ${job.jobId}`);
  if (job.notes.toLowerCase().includes("direct recruiting contacts")) {
    details.push("Contact search needs recruiter/talent fallback review");
  }
  if (job.notes) details.push(job.notes);
  return details;
}
