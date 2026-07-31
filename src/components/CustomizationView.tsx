import { Download, RotateCcw, SlidersHorizontal, Upload } from "lucide-react";
import type { WorkflowPreferences } from "../types";

interface CustomizationViewProps {
  value: WorkflowPreferences;
  onChange: (value: WorkflowPreferences) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function CustomizationView({ value, onChange, onReset, onExport, onImport }: CustomizationViewProps) {
  const updateModule = (name: keyof WorkflowPreferences["modules"], enabled: boolean) => {
    onChange({ ...value, modules: { ...value.modules, [name]: enabled } });
  };
  return (
    <section className="customization-view">
      <header className="studio-heading">
        <div><span className="eyebrow">Operator preferences</span><h2>Customize the console</h2></div>
        <div className="studio-actions">
          <button className="small-button" onClick={onExport}><Download size={15} /> Export configuration</button>
          <button className="small-button" onClick={onImport}><Upload size={15} /> Import configuration</button>
          <button className="small-button" onClick={onReset}><RotateCcw size={15} /> Reset</button>
        </div>
      </header>

      <div className="preference-band">
        <h3><SlidersHorizontal size={16} /> Appearance</h3>
        <div className="preference-grid">
          <label>Theme<select value={value.colorTheme} onChange={(event) => onChange({ ...value, colorTheme: event.target.value as WorkflowPreferences["colorTheme"] })}><option value="terminal">Terminal dark</option><option value="light">Light</option><option value="high_contrast">High contrast</option></select></label>
          <label>Density<select value={value.density} onChange={(event) => onChange({ ...value, density: event.target.value as WorkflowPreferences["density"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
          <label>Accent<select value={value.accentColor} onChange={(event) => onChange({ ...value, accentColor: event.target.value as WorkflowPreferences["accentColor"] })}><option value="green">Green</option><option value="cyan">Cyan</option><option value="amber">Amber</option></select></label>
          <label className="toggle-row compact-toggle"><input type="checkbox" checked={value.reduceMotion} onChange={(event) => onChange({ ...value, reduceMotion: event.target.checked })} /><span><strong>Reduce motion</strong><small>Disables nonessential interface movement.</small></span></label>
        </div>
      </div>

      <div className="preference-band">
        <h3>Workflow defaults</h3>
        <div className="preference-grid">
          <label>Email spacing (seconds)<input type="number" min="15" max="3600" value={value.defaultSpacingSeconds} onChange={(event) => onChange({ ...value, defaultSpacingSeconds: Number(event.target.value) })} /></label>
          <label>Contacts per company<input type="number" min="1" max="12" value={value.defaultContactTarget} onChange={(event) => onChange({ ...value, defaultContactTarget: Number(event.target.value) })} /></label>
          <label>Repeat-company cooldown (days)<input type="number" min="0" max="3650" value={value.companyCooldownDays} onChange={(event) => onChange({ ...value, companyCooldownDays: Number(event.target.value) })} /></label>
          <label>Mailbox monitoring after send (minutes)<input type="number" min="0" max="1440" value={value.mailboxMonitorMinutes} onChange={(event) => onChange({ ...value, mailboxMonitorMinutes: Number(event.target.value) })} /></label>
        </div>
        <div className="rule-toggles">
          <label className="toggle-row"><input type="checkbox" checked={value.requireDraftReview} onChange={(event) => onChange({ ...value, requireDraftReview: event.target.checked })} /><span><strong>Require draft review</strong><small>Blocks automatic provider draft creation until messages are reviewed.</small></span></label>
          <label className="toggle-row"><input type="checkbox" checked={value.requireSendApproval} onChange={(event) => onChange({ ...value, requireSendApproval: event.target.checked })} /><span><strong>Require send approval</strong><small>The backend and MCP still enforce their own confirmation gates.</small></span></label>
          <label className="toggle-row"><input type="checkbox" checked={value.autoPrepareRedirectDrafts} onChange={(event) => onChange({ ...value, autoPrepareRedirectDrafts: event.target.checked })} /><span><strong>Prepare redirect drafts</strong><small>Creates a review item when an OOO or wrong-person reply names another contact.</small></span></label>
        </div>
      </div>

      <div className="preference-band">
        <h3>Visible work areas</h3>
        <div className="module-grid">
          {Object.entries(value.modules).map(([name, enabled]) => (
            <label key={name}><input type="checkbox" checked={enabled} onChange={(event) => updateModule(name as keyof WorkflowPreferences["modules"], event.target.checked)} /><span>{name.replaceAll("_", " ")}</span></label>
          ))}
        </div>
        <p>Hidden areas retain their data. Setup, jobs, source files, reports, queue review, and writing controls always remain available.</p>
      </div>
    </section>
  );
}
