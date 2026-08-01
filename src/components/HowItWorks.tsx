import { BookOpen, Check, ChevronRight, CircleHelp, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProcessDestination } from "../lib/workflow-guide";

const steps = [
  { label: "Apply", detail: "Submit the application yourself and keep the job link and description.", destination: "jobs" as const },
  { label: "Import", detail: "Import CSV/XLSX or enter an application. The console validates the minimum columns.", destination: "jobs" as const },
  { label: "Find contacts", detail: "Use a tested provider or enter verified recruiting contacts manually.", destination: "activity" as const },
  { label: "Write", detail: "Create a template, use a connected AI, use an outside AI, or write each message yourself.", destination: "writing" as const },
  { label: "Review", detail: "Check the recipient, role facts, links, attachments, wording, and approval state.", destination: "writing" as const },
  { label: "Send", detail: "Run a dry check or schedule the connected workflow. Sending remains confirmation-gated.", destination: "jobs" as const },
  { label: "Monitor", detail: "Review replies, redirects, bounces, interviews, and follow-ups in Activity and Today.", destination: "activity" as const },
];

export function HowItWorks({ onNavigate, onStartSyntheticDemo, onDemoStep }: { onNavigate: (destination: ProcessDestination) => void; onStartSyntheticDemo: () => void; onDemoStep: (index: number) => void }) {
  const [demoStep, setDemoStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (demoStep >= steps.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => {
      const next = demoStep + 1;
      setDemoStep(next);
      onDemoStep(next);
    }, demoStep < 0 ? 250 : 1500);
    return () => window.clearTimeout(timer);
  }, [demoStep, playing, onDemoStep]);
  function start() {
    onStartSyntheticDemo();
    setDemoStep(-1);
    setPlaying(true);
  }
  return (
    <section className="how-it-works">
      <header><div><span className="eyebrow">One clear path</span><h1>How it works</h1><p>Start with the short version, run a safe sample, or open the detailed reference when you need it.</p></div></header>
      <section className="overview-block">
        <div className="section-title"><span>30-second overview</span><strong>Apply -&gt; Import -&gt; Find contacts -&gt; Write -&gt; Review -&gt; Send -&gt; Monitor</strong></div>
        <div className="overview-flow">{steps.map((step, index) => <div key={step.label}><button onClick={() => onNavigate(step.destination)}><span>{index + 1}</span><strong>{step.label}</strong></button>{index < steps.length - 1 && <ChevronRight size={16} />}</div>)}</div>
      </section>
      <section className="guided-demo">
        <header><div><span className="eyebrow">10-minute guided demonstration</span><h2>Watch a complete synthetic dry run</h2><p>No provider, credit, AI, or email service is called. Autoplay advances in seconds; pause on each stage to explore the full walkthrough.</p></div><button className="continue-button" onClick={start}>{demoStep >= steps.length - 1 ? <RotateCcw size={16} /> : <Play size={16} />}{playing ? "Demonstration running" : demoStep >= steps.length - 1 ? "Run again" : "Start guided demonstration"}</button></header>
        <div className="demo-track">{steps.map((step, index) => <article key={step.label} className={index < demoStep ? "complete" : index === demoStep ? "active" : "upcoming"}><span>{index < demoStep ? <Check size={14} /> : index + 1}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div></article>)}</div>
      </section>
      <section className="reference-block">
        <div className="section-title"><BookOpen size={17} /><strong>Detailed reference</strong></div>
        <details><summary>What is automated, and what still requires me?</summary><p>Imports, validation, stage tracking, template generation, daily queues, and dry checks work locally. Contact discovery, AI writing, email creation, sending, and mailbox monitoring require the matching provider to be connected and pass its own test. Review and sending stay under your control by default.</p></details>
        <details><summary>Provider setup and readiness</summary><p>Selecting a provider is only a preference. It becomes ready after its exact credential and connection test passes. Selecting No provider means manual contact entry or manual email handling, with no adapter warning.</p></details>
        <details><summary>Why work becomes blocked</summary><p>Common blockers are missing company, role, URL, profile, verified contacts, message content, recipient details, or approval. Every blocked queue item offers Find contacts, Enter contacts, or Remove from batch as appropriate.</p></details>
        <details><summary>Failure recovery</summary><p>Problems and redirects collects bounces, wrong-person replies, out-of-office redirects, and provider failures. A failed provider does not erase the batch: use a fallback, enter a contact, defer the item, or remove it from the current batch.</p></details>
        <details><summary>Terminology</summary><dl><dt>Dry check</dt><dd>Builds and validates the workflow without sending.</dd><dt>Connected workflow</dt><dd>Uses the local service and only providers that passed their checks.</dd><dt>Daily queue</dt><dd>A saved set of due work that can be resumed in one click.</dd><dt>Profile</dt><dd>A reusable sender identity, resume, and role focus.</dd><dt>People per company</dt><dd>The preferred number of direct contacts, never invented placeholders.</dd></dl></details>
        <div className="reference-help"><CircleHelp size={16} /><span>Setup, Troubleshooting, and the process rail link back to this explanation instead of assuming technical knowledge.</span></div>
      </section>
    </section>
  );
}
