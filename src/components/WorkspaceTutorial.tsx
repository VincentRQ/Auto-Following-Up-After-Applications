import { ArrowLeft, ArrowRight, BookOpen, Check, Map, X } from "lucide-react";
import { useEffect, useState } from "react";

export type TutorialTarget = "top" | "tabs" | "source" | "left" | "jobs" | "writing" | "right" | "mailbox" | "calendar" | "customize";

interface TutorialStep {
  area: string;
  title: string;
  body: string;
  actions: string[];
  note: string;
  target: TutorialTarget;
}

const tutorialSteps: TutorialStep[] = [
  {
    area: "Screen map",
    title: "Start with the four working areas",
    body: "The buttons across the top switch workspaces. The left column controls the active profile and send timing. The center is where you add jobs, write messages, and review records. The right column holds checks, results, mailbox activity, and recovery work.",
    actions: ["Use Setup wizard for accounts and providers.", "Use this Guide button whenever you need the operating walkthrough."],
    note: "Nothing sends because you opened a tab. Sending begins only after jobs pass review and you launch a batch.",
    target: "top",
  },
  {
    area: "After applying",
    title: "Record the application before you move on",
    body: "Open Jobs and choose Add application. Enter the company, role, job link, description, profile, and application date. The row is saved in this browser immediately. You do not need a spreadsheet for this path.",
    actions: ["Use the exact job link when possible.", "Paste enough of the description to support contact research and a specific email.", "Choose the profile whose sender and resume match the application."],
    note: "If you linked a CSV, the new row can be written back to that file. Otherwise it remains in the local workspace and can be exported later.",
    target: "jobs",
  },
  {
    area: "Data Source",
    title: "Choose how the application list is kept",
    body: "Data Source supports three practical paths: enter jobs in the app, link a CSV that stays synchronized, or import a CSV/XLSX copy. A linked CSV is the best choice when you want the same working file outside the console.",
    actions: ["Required fields are company, role, and job link.", "CSV supports write-back in Chrome or Edge.", "XLSX imports safely, but app edits are exported as CSV."],
    note: "The source badge in the left column shows whether changes are saved, waiting, or in conflict.",
    target: "source",
  },
  {
    area: "Profiles",
    title: "Route each job through the correct identity",
    body: "A profile groups the sender name, sender account, resume, and job focus. Create as many as you need. Each application row keeps its own profile, so one batch cannot silently switch to another identity.",
    actions: ["Add or edit profiles in Profiles.", "Check the active profile in the left column before selecting jobs.", "Keep resume labels clear enough to distinguish similar files."],
    note: "Changing the batch profile filters the job list. It does not rewrite jobs assigned to another profile.",
    target: "tabs",
  },
  {
    area: "Jobs",
    title: "Select the applications that belong in one run",
    body: "Search or filter the job table, then select the rows you want. The operational check above the table separates ready rows from blocked or previously sent rows before anything reaches a provider.",
    actions: ["Open a selected row to correct its ID, status, link, description, or notes.", "Use Ready only when you want the console to drop blocked rows from the selection.", "Review repeat-company and contact warnings before continuing."],
    note: "A dry run is the safest first pass. It produces a plan and summary without creating provider sends.",
    target: "jobs",
  },
  {
    area: "Writing",
    title: "Review what each person will receive",
    body: "Writing holds the subject, message template, shared prompt, and one draft per recipient. You can write manually, use templates, pass the draft to an outside AI, or use a configured in-app model.",
    actions: ["Keep the role link and position ID when available.", "Use one real detail from the job post.", "Review names, addresses, links, and attachments before approval."],
    note: "The selected AI mode controls who writes. It does not remove the review and send gates configured in Customize.",
    target: "writing",
  },
  {
    area: "Left column",
    title: "Set the run without creating a burst of mail",
    body: "The left column chooses the profile, start time, delay between messages, number of contacts per company, and run mode. These settings apply to the current batch only.",
    actions: ["Use a measured spacing value instead of sending every message at once.", "Start with dry run when a provider or template changed.", "Check the local service before a backend run."],
    note: "Launch arms a future run or starts an immediate one. The status at the top tells you when a batch is armed.",
    target: "left",
  },
  {
    area: "Right column",
    title: "Use Queue before launch and Run Summary after it",
    body: "Queue explains which selected rows can proceed. Run Summary records what was prepared, skipped, or blocked. Setup checks connections, while Debug explains missing fields and operational conflicts.",
    actions: ["Resolve queue blockers before a live run.", "Export the run summary when you need an audit copy.", "Open Setup when the system badge says attention is needed."],
    note: "You can drag either vertical divider to give the center, left, or right area more room. Keyboard arrow keys work on the divider too.",
    target: "right",
  },
  {
    area: "Replies and recovery",
    title: "Handle what happens after outreach",
    body: "Mail shows replies and delivery events pulled by a configured mailbox adapter. Recovery turns bounces, redirects, missing contacts, and repeated failures into review items instead of letting one failure stop the rest of a batch.",
    actions: ["Check whether you already replied before drafting another response.", "Follow a named redirect only after confirming the company and role match.", "Use company history to avoid duplicate outreach."],
    note: "Browser-only mode keeps the manual workflow available. Automatic mailbox and recovery work needs the local service and a mailbox connection.",
    target: "mailbox",
  },
  {
    area: "Calendar",
    title: "Export only the events worth seeing elsewhere",
    body: "The calendar shows dated application activity. Export uses a standard .ics file accepted by Google Calendar, Outlook, Apple Calendar, and most other calendar apps.",
    actions: ["Interviews and replies are selected by default.", "Applications and outreach stay off unless you turn them on.", "Alerts are off until you choose one."],
    note: "Export is manual, so reviewing the same month again cannot silently add events to an external calendar.",
    target: "calendar",
  },
  {
    area: "Customize",
    title: "Make the console fit the way you work",
    body: "Customize controls the full color theme, density, panel widths, safety gates, default pacing, and optional work areas. Configuration export saves these choices without credentials.",
    actions: ["Use Reset panel sizes if a divider was dragged too far.", "Keep draft review and send approval on until your workflow is proven.", "Hide areas you do not use; their saved data remains intact."],
    note: "Return to Setup for accounts, adapters, storage, and the initial setup wizard. Return to Guide for this walkthrough.",
    target: "customize",
  },
];

export function WorkspaceTutorial({ initialStep, onNavigate, onProgress, onClose, onSkip, onComplete }: {
  initialStep: number;
  onNavigate: (target: TutorialTarget) => void;
  onProgress: (step: number) => void;
  onClose: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(Math.min(Math.max(initialStep, 0), tutorialSteps.length - 1));
  const step = tutorialSteps[stepIndex];

  useEffect(() => {
    onNavigate(step.target);
    onProgress(stepIndex);
    // Parent callbacks intentionally follow the selected step; they do not control step state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  function move(offset: number) {
    setStepIndex((current) => Math.min(Math.max(current + offset, 0), tutorialSteps.length - 1));
  }

  return (
    <section className="workspace-tutorial" role="dialog" aria-modal="false" aria-labelledby="tutorial-title">
      <header>
        <div><span className="eyebrow"><BookOpen size={13} /> Operating guide</span><strong>{stepIndex + 1} / {tutorialSteps.length}</strong></div>
        <button className="icon-button" title="Close guide for now" onClick={onClose}><X size={17} /></button>
      </header>
      <div className="tutorial-meter" aria-hidden="true"><span style={{ width: `${((stepIndex + 1) / tutorialSteps.length) * 100}%` }} /></div>
      <div className="tutorial-content">
        <span className="tutorial-area"><Map size={14} /> {step.area}</span>
        <h2 id="tutorial-title">{step.title}</h2>
        <p>{step.body}</p>
        <ul>{step.actions.map((action) => <li key={action}>{action}</li>)}</ul>
        <div className="tutorial-note"><Check size={15} /><span>{step.note}</span></div>
      </div>
      <footer>
        <button className="text-button" onClick={onSkip}>Skip tutorial</button>
        <div>
          <button className="ghost-button" disabled={stepIndex === 0} onClick={() => move(-1)}><ArrowLeft size={15} /> Back</button>
          {stepIndex < tutorialSteps.length - 1
            ? <button className="launch-button" onClick={() => move(1)}>Next <ArrowRight size={15} /></button>
            : <button className="launch-button" onClick={onComplete}><Check size={15} /> Finish</button>}
        </div>
      </footer>
    </section>
  );
}

export const workspaceTutorialStepCount = tutorialSteps.length;
