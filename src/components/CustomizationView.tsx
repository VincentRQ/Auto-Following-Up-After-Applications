import { Check, Clock3, Download, MailCheck, PanelLeftClose, Palette, RotateCcw, Send, Upload } from "lucide-react";
import type { WorkflowPreferences } from "../types";

interface CustomizationViewProps {
  value: WorkflowPreferences;
  onChange: (value: WorkflowPreferences) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
  onResetPanels: () => void;
}

const themes: Array<{ value: WorkflowPreferences["colorTheme"]; label: string; description: string; colors: string[] }> = [
  { value: "terminal", label: "Terminal", description: "Balanced green and cyan operations view.", colors: ["#090b0a", "#48d597", "#7dd3fc"] },
  { value: "amber_console", label: "Amber Console", description: "Framed monochrome display with amber readouts.", colors: ["#080400", "#ffb000", "#ffe1a3"] },
  { value: "light", label: "Daylight", description: "Bright workspace for daytime environments.", colors: ["#f1f5f3", "#08794f", "#b72d3a"] },
  { value: "graphite", label: "Graphite", description: "Neutral dark surfaces with soft signals.", colors: ["#161719", "#68d5c4", "#ff7a8a"] },
  { value: "mulberry", label: "Mulberry", description: "Warm dark surfaces with cool actions.", colors: ["#1b1018", "#8de1bd", "#83c8ff"] },
  { value: "high_contrast", label: "High contrast", description: "Maximum separation for critical controls.", colors: ["#000000", "#60ffa9", "#ffd166"] },
];

const accents: Array<{ value: WorkflowPreferences["accentColor"]; label: string; color: string }> = [
  { value: "green", label: "Green", color: "#48d597" },
  { value: "cyan", label: "Cyan", color: "#7dd3fc" },
  { value: "amber", label: "Amber", color: "#f0b95e" },
  { value: "rose", label: "Rose", color: "#ff7a8a" },
  { value: "violet", label: "Violet", color: "#b794f4" },
];

const backgroundEffects: Array<{ value: WorkflowPreferences["backgroundEffect"]; label: string }> = [
  { value: "off", label: "Off" },
  { value: "scanlines", label: "Slow scanlines" },
  { value: "grid_drift", label: "Drifting grid" },
  { value: "signal_sweep", label: "Signal sweep" },
  { value: "data_points", label: "Data points" },
  { value: "circuit_traces", label: "Circuit traces" },
];

export function CustomizationView({ value, onChange, onReset, onExport, onImport, onResetPanels }: CustomizationViewProps) {
  const selectedTheme = themes.find((theme) => theme.value === value.colorTheme) ?? themes[0];
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
        <h3><Palette size={16} /> Full color theme</h3>
        <div className="theme-picker" aria-label="Full color theme">
          {themes.map((theme) => {
            const active = value.colorTheme === theme.value;
            return (
              <button key={theme.value} type="button" className={active ? "active" : ""} aria-pressed={active} onClick={() => onChange({ ...value, colorTheme: theme.value })}>
                <span className="theme-swatches" aria-hidden="true">{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                <span className="theme-option-copy"><strong>{theme.label}</strong><small>{theme.description}</small></span>
                {active && <Check className="theme-selected-icon" size={15} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="theme-specimen" aria-label={`${selectedTheme.label} interface preview`}>
          <header><span>Live interface preview</span><strong>{selectedTheme.label}</strong></header>
          <div className="theme-specimen-grid">
            <div><Send size={15} aria-hidden="true" /><span>Scheduled</span><output>6</output></div>
            <div><MailCheck size={15} aria-hidden="true" /><span>Replies</span><output>2</output></div>
            <div><Clock3 size={15} aria-hidden="true" /><span>Spacing</span><output>{value.defaultSpacingSeconds}s</output></div>
          </div>
          <div className="theme-specimen-meter"><span>Batch readiness</span><strong>4 of 6 reviewed</strong><i role="progressbar" aria-label="Batch readiness" aria-valuemin={0} aria-valuemax={6} aria-valuenow={4}><b /></i></div>
          <footer><span className="theme-preview-status"><i /> Ready to run</span><span>Review remains required</span></footer>
        </div>
        <p>Theme changes the full workspace. Accent changes primary actions; background effects remain optional. Amber Console is a lightweight adaptation inspired by the open-source AmberConsole design system.</p>
        <div className="preference-grid">
          <label>Density<select value={value.density} onChange={(event) => onChange({ ...value, density: event.target.value as WorkflowPreferences["density"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
          <label>Background effect<select value={value.backgroundEffect} onChange={(event) => onChange({ ...value, backgroundEffect: event.target.value as WorkflowPreferences["backgroundEffect"] })}>{backgroundEffects.map((effect) => <option key={effect.value} value={effect.value}>{effect.label}</option>)}</select></label>
          <label className="toggle-row compact-toggle"><input type="checkbox" checked={value.reduceMotion} onChange={(event) => onChange({ ...value, reduceMotion: event.target.checked })} /><span><strong>Reduce motion</strong><small>Disables nonessential interface movement.</small></span></label>
        </div>
        <div className="accent-picker" aria-label="Accent color">{accents.map((accent) => <button key={accent.value} className={value.accentColor === accent.value ? "active" : ""} onClick={() => onChange({ ...value, accentColor: accent.value })}><i style={{ background: accent.color }} /><span>{accent.label}</span></button>)}</div>
      </div>

      <div className="preference-band">
        <div className="preference-heading"><h3><PanelLeftClose size={16} /> Panel sizes</h3><button className="small-button compact" onClick={onResetPanels}><RotateCcw size={14} /> Reset panel sizes</button></div>
        <p>Drag the vertical dividers on the main screen, or set exact widths here. The center uses the remaining space.</p>
        <div className="panel-size-controls">
          <label>Left column <strong>{value.leftPanelWidth}px</strong><input type="range" min="220" max="440" step="10" value={value.leftPanelWidth} onChange={(event) => onChange({ ...value, leftPanelWidth: Number(event.target.value) })} /></label>
          <label>Right column <strong>{value.rightPanelWidth}px</strong><input type="range" min="260" max="520" step="10" value={value.rightPanelWidth} onChange={(event) => onChange({ ...value, rightPanelWidth: Number(event.target.value) })} /></label>
        </div>
      </div>

      <div className="preference-band">
        <h3>Workflow defaults</h3>
        <div className="preference-grid">
          <label>Default interface<select value={value.interfaceMode} onChange={(event) => onChange({ ...value, interfaceMode: event.target.value as WorkflowPreferences["interfaceMode"] })}><option value="simple">Simple</option><option value="advanced">Advanced console</option></select></label>
          <label>Email spacing (seconds)<input type="number" min="15" max="3600" value={value.defaultSpacingSeconds} onChange={(event) => onChange({ ...value, defaultSpacingSeconds: Number(event.target.value) })} /></label>
          <label>Contacts per company<input type="number" min="1" max="12" value={value.defaultContactTarget} onChange={(event) => onChange({ ...value, defaultContactTarget: Number(event.target.value) })} /></label>
          <label>Repeat-company cooldown (days)<input type="number" min="0" max="3650" value={value.companyCooldownDays} onChange={(event) => onChange({ ...value, companyCooldownDays: Number(event.target.value) })} /></label>
          <label>Mailbox monitoring after send (minutes)<input type="number" min="0" max="1440" value={value.mailboxMonitorMinutes} onChange={(event) => onChange({ ...value, mailboxMonitorMinutes: Number(event.target.value) })} /></label>
          <label>Follow-up due after (days)<input type="number" min="1" max="90" value={value.followUpDays} onChange={(event) => onChange({ ...value, followUpDays: Number(event.target.value) })} /></label>
          <label>Daily queue size<input type="number" min="1" max="100" value={value.dailyQueueLimit} onChange={(event) => onChange({ ...value, dailyQueueLimit: Number(event.target.value) })} /></label>
          <label>Provider credit behavior<select value={value.providerCreditMode} onChange={(event) => onChange({ ...value, providerCreditMode: event.target.value as WorkflowPreferences["providerCreditMode"] })}><option value="ask">Ask before lookup</option><option value="allow">Allow configured lookups</option><option value="never">Never spend credits</option></select></label>
        </div>
        <div className="rule-toggles">
          <label className="toggle-row"><input type="checkbox" checked={value.showProcessRail} onChange={(event) => onChange({ ...value, showProcessRail: event.target.checked })} /><span><strong>Show process rail</strong><small>Keeps the seven batch stages visible and clickable.</small></span></label>
          <label className="toggle-row"><input type="checkbox" checked={value.showGuidancePanel} onChange={(event) => onChange({ ...value, showGuidancePanel: event.target.checked })} /><span><strong>Show next-step guidance</strong><small>Explains the current stage, next action, automation, and blockers.</small></span></label>
          <label className="toggle-row"><input type="checkbox" checked={value.dailySummaryEnabled} onChange={(event) => onChange({ ...value, dailySummaryEnabled: event.target.checked })} /><span><strong>Show daily summary</strong><small>Displays the recurring queue and due work on Today. No notification leaves the app.</small></span></label>
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
