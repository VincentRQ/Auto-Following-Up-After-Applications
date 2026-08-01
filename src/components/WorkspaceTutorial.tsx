import { ArrowLeft, ArrowRight, BookOpen, Check, Map, X } from "lucide-react";
import { useEffect, useState } from "react";

export type TutorialTarget = "top" | "tabs" | "today" | "jobs" | "writing" | "activity" | "settings";

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
    area: "Start here",
    title: "Today tells you where to resume",
    body: "Today is the default screen. It brings together new applications, missing contacts, messages awaiting review, scheduled work, replies, redirects, interviews, and follow-ups that are due.",
    actions: ["Use Continue where I left off for the best next action.", "Save a daily queue when you want tomorrow to start from the same set of work."],
    note: "The summary is local unless you connect providers. Opening Today never sends or changes an external account.",
    target: "today",
  },
  {
    area: "Process rail",
    title: "Follow one visible path from application to response",
    body: "The process rail stays visible across the main screens. Every stage shows a count and state. Select a stage to open the place where that work can be completed.",
    actions: ["Green means complete for the current batch.", "Red means blocked and includes a corrective action.", "The guidance panel explains what the next click will do."],
    note: "The rail reflects the selected batch, while Today summarizes the wider workspace.",
    target: "tabs",
  },
  {
    area: "Applications",
    title: "Import or enter the work you already applied for",
    body: "Applications accepts CSV, XLSX, a linked CSV, or manual entry. Company, role title, and job URL are the minimum fields. The importer checks the file before replacing the current workspace.",
    actions: ["Use the exact job link when possible.", "Include the description for more specific writing.", "Choose the profile that matches the sender and resume."],
    note: "Linked CSV is the only automatic file write-back path. Other imports remain locally saved and can be exported.",
    target: "jobs",
  },
  {
    area: "Contacts",
    title: "Resolve contact gaps without inventing recipients",
    body: "A job with no verified contact is blocked. Activity offers Find contacts when a tested provider is available, Enter contact for manual research, and Remove from batch without deleting the application.",
    actions: ["A selected provider is not ready until its exact connection test passes.", "Credit behavior is adjustable in Customize.", "One provider failure does not stop unrelated jobs."],
    note: "The console never creates generic Contact 1, Contact 2, or Contact 3 recipients for a zero-contact job.",
    target: "activity",
  },
  {
    area: "Messages",
    title: "Use only the writing method selected during setup",
    body: "Messages can use templates, manual writing, an outside AI, or a tested in-app AI. Setup ownership controls which choices appear, so Templates only cannot silently become Outside AI later.",
    actions: ["Review each name, address, role fact, link, and message.", "Keep provider creation and sending behind their separate approval gates.", "Prepare creates one slot per known contact only."],
    note: "Changing writing ownership does not send anything; it only changes how draft text is prepared.",
    target: "writing",
  },
  {
    area: "Schedule",
    title: "The main action says exactly what it will do",
    body: "Applications shows the profile, start time, people per company, spacing in seconds, and run choice. The button names the exact dry-check or scheduled action and its time.",
    actions: ["Use Run dry check now after provider, template, or file changes.", "Browser-only mode hides connected execution.", "Review blockers before scheduling."],
    note: "A dry check creates a local plan and summary. It does not send email.",
    target: "jobs",
  },
  {
    area: "Activity",
    title: "Handle replies, redirects, bounces, and due follow-ups",
    body: "Activity combines the current queue, recent replies, problems and redirects, and recurring follow-ups. Connected mailbox data is refreshed only when the mailbox provider is configured and tested.",
    actions: ["Check whether a reply was already handled.", "Follow a named redirect only after matching the company and role.", "Use the company history in Advanced view when duplicate outreach is a concern."],
    note: "Browser-only mode leaves these records manual and says so explicitly.",
    target: "activity",
  },
  {
    area: "Settings",
    title: "Keep the everyday screen simple; open technical controls when needed",
    body: "Settings links to setup, profiles, source files, customization, troubleshooting, and reset. Advanced view restores the full three-panel console and provider diagnostics for technical users.",
    actions: ["Use How it works for the overview, safe demonstration, and reference.", "Use Setup wizard to verify providers.", "Use Start fresh only after reviewing the automatic backup."],
    note: "Simple and Advanced views use the same data. Switching views does not remove configuration or history.",
    target: "settings",
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
