import { AlertTriangle, Bot, MousePointerClick, UserRoundCheck } from "lucide-react";
import type { ProcessDestination, WorkflowGuidance } from "../lib/workflow-guide";

export function WorkflowCompass({ guidance, onContinue }: { guidance: WorkflowGuidance; onContinue: (destination: ProcessDestination) => void }) {
  return (
    <section className="workflow-compass" aria-labelledby="workflow-compass-title">
      <header>
        <div><span className="eyebrow">Where you are</span><h2 id="workflow-compass-title">{guidance.location}</h2></div>
        <button className="continue-button" type="button" onClick={() => onContinue(guidance.nextDestination)}>{guidance.nextAction}</button>
      </header>
      <div className="compass-grid">
        <div><MousePointerClick size={16} /><span><strong>What this does</strong>{guidance.clickResult}</span></div>
        <div><Bot size={16} /><span><strong>Automated here</strong>{guidance.automated}</span></div>
        <div><UserRoundCheck size={16} /><span><strong>Still requires you</strong>{guidance.manual}</span></div>
        {guidance.blocker && <div className="compass-blocker"><AlertTriangle size={16} /><span><strong>Why this is blocked</strong>{guidance.blocker}<em>{guidance.fix}</em></span></div>}
      </div>
    </section>
  );
}
