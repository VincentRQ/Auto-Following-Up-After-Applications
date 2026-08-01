import { AlertTriangle, Check, ChevronRight } from "lucide-react";
import type { ProcessDestination, ProcessStage } from "../lib/workflow-guide";

export function ProcessRail({ stages, onNavigate }: { stages: ProcessStage[]; onNavigate: (destination: ProcessDestination) => void }) {
  return (
    <nav className="process-rail" aria-label="Batch progress">
      {stages.map((stage, index) => (
        <div className="process-rail-segment" key={stage.id}>
          <button type="button" className={`process-stage ${stage.status}`} onClick={() => onNavigate(stage.destination)} title={`${stage.detail} ${stage.action}.`}>
            <span className="process-stage-icon" aria-hidden="true">
              {stage.status === "complete" ? <Check size={14} /> : stage.status === "blocked" ? <AlertTriangle size={14} /> : index + 1}
            </span>
            <span><strong>{stage.label}</strong><small>{stage.count} / {stage.status}</small><em>{stage.action}</em></span>
          </button>
          {index < stages.length - 1 && <ChevronRight className="process-chevron" size={15} aria-hidden="true" />}
        </div>
      ))}
    </nav>
  );
}
