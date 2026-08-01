import { AlertTriangle, CalendarCheck, Clock3, ContactRound, FileText, Inbox, ListRestart, MessageSquareReply, Play, Save, Send, UsersRound } from "lucide-react";
import type { DailyQueueState, JobRow, MessageDraft } from "../types";
import type { RoutineSummary } from "../lib/routine";
import type { ProcessDestination, WorkflowGuidance } from "../lib/workflow-guide";

interface TodayViewProps {
  jobs: JobRow[];
  drafts: MessageDraft[];
  routine: RoutineSummary;
  queue: DailyQueueState;
  guidance: WorkflowGuidance;
  scheduledCount: number;
  replyCount: number;
  redirectCount: number;
  dailySummaryEnabled: boolean;
  onContinue: (destination: ProcessDestination) => void;
  onSaveQueue: () => void;
  onResumeQueue: () => void;
}

export function TodayView(props: TodayViewProps) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const active = props.jobs.filter((job) => !["rejected", "bounced", "skipped"].includes(job.status));
  const metrics = [
    { label: "New applications", value: props.jobs.filter((job) => timestamp(job.importedAt || job.appliedAt) >= start).length, icon: FileText, destination: "jobs" as const },
    { label: "Contacts needed", value: active.filter((job) => (job.contactsFound ?? 0) <= 0).length, icon: ContactRound, destination: "activity" as const },
    { label: "Drafts awaiting review", value: props.drafts.filter((draft) => !["approved", "sent"].includes(draft.status)).length, icon: Inbox, destination: "writing" as const },
    { label: "Scheduled messages", value: props.scheduledCount, icon: Send, destination: "jobs" as const },
    { label: "Replies requiring attention", value: props.replyCount, icon: MessageSquareReply, destination: "activity" as const },
    { label: "Problems and redirects", value: props.redirectCount, icon: AlertTriangle, destination: "activity" as const },
    { label: "Interviews", value: props.jobs.filter((job) => job.status === "interview").length, icon: CalendarCheck, destination: "activity" as const },
    { label: "Follow-ups due", value: props.routine.overdue.length + props.routine.dueToday.length, icon: Clock3, destination: "activity" as const },
  ];
  return (
    <section className="today-view">
      <header className="today-heading">
        <div><span className="eyebrow">Daily workspace</span><h1>Today</h1><p>One place for the applications, messages, replies, and follow-ups that need attention now.</p></div>
        <button className="continue-button large" onClick={() => props.onContinue(props.guidance.nextDestination)}><Play size={17} /> Continue where I left off</button>
      </header>
      <div className="today-metrics">
        {metrics.map(({ label, value, icon: Icon, destination }) => <button key={label} onClick={() => props.onContinue(destination)}><Icon size={18} /><span>{label}</span><strong>{value}</strong></button>)}
      </div>
      {props.dailySummaryEnabled && <div className="today-columns">
        <section className="daily-queue-panel">
          <header><div><span className="eyebrow">Saved routine</span><h2>Daily queue</h2></div><span>{props.queue.jobIds.length} saved</span></header>
          {props.queue.jobIds.length ? <><p>Your saved queue is ready to resume. Applications that no longer exist are ignored automatically.</p><button className="small-button" onClick={props.onResumeQueue}><ListRestart size={15} /> Resume saved queue</button></> : <><p>Save the most useful follow-up work so tomorrow starts from the same place.</p><button className="small-button" disabled={!props.routine.suggestedJobIds.length} onClick={props.onSaveQueue}><Save size={15} /> Save suggested queue</button></>}
        </section>
        <section className="due-panel">
          <header><div><span className="eyebrow">Recurring work</span><h2>Due and overdue</h2></div><UsersRound size={18} /></header>
          {props.routine.overdue.length + props.routine.dueToday.length === 0 ? <p>No follow-ups are due today.</p> : <div className="routine-list">{[...props.routine.overdue, ...props.routine.dueToday].slice(0, 6).map((item) => <button key={item.job.id} onClick={() => props.onContinue("jobs")}><span><strong>{item.job.company}</strong><small>{item.job.roleTitle}</small></span><em>{item.state === "overdue" ? "Overdue" : "Due today"}</em></button>)}</div>}
        </section>
      </div>}
    </section>
  );
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
