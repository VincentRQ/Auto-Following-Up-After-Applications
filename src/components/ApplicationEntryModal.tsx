import { BriefcaseBusiness, Plus, X } from "lucide-react";
import { useState } from "react";
import type { JobRow, ProfileDefinition, ProfileKey } from "../types";

export interface NewApplicationInput {
  company: string;
  roleTitle: string;
  jobUrl: string;
  jobDescription: string;
  jobId: string;
  profile: ProfileKey;
  source: string;
  status: JobRow["status"];
  appliedDate: string;
  notes: string;
}

export function ApplicationEntryModal({ profiles, activeProfile, onClose, onSave }: {
  profiles: ProfileDefinition[];
  activeProfile: ProfileKey;
  onClose: () => void;
  onSave: (value: NewApplicationInput) => void;
}) {
  const [value, setValue] = useState<NewApplicationInput>({
    company: "",
    roleTitle: "",
    jobUrl: "",
    jobDescription: "",
    jobId: "",
    profile: activeProfile,
    source: "Manual entry",
    status: "applied",
    appliedDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [error, setError] = useState("");

  function save() {
    if (!value.company.trim() || !value.roleTitle.trim() || !value.jobUrl.trim()) {
      setError("Company, role, and job link are required.");
      return;
    }
    try {
      const parsed = new URL(value.jobUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      setError("Enter a complete http or https job link.");
      return;
    }
    onSave({ ...value, company: value.company.trim(), roleTitle: value.roleTitle.trim(), jobUrl: value.jobUrl.trim(), jobId: value.jobId.trim(), source: value.source.trim() || "Manual entry" });
  }

  return (
    <div className="modal-backdrop application-entry-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="application-entry-modal" role="dialog" aria-modal="true" aria-labelledby="application-entry-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span className="eyebrow">After you apply</span><h2 id="application-entry-title">Add application</h2></div>
          <button className="icon-button" title="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="application-entry-intro"><BriefcaseBusiness size={18} /><span>Add the job now so contact research, writing, status checks, and calendar activity all use the same record.</span></div>
        <div className="application-entry-grid">
          <label>Company<input autoFocus value={value.company} onChange={(event) => setValue({ ...value, company: event.target.value })} placeholder="Company name" /></label>
          <label>Role<input value={value.roleTitle} onChange={(event) => setValue({ ...value, roleTitle: event.target.value })} placeholder="Job title" /></label>
          <label className="wide-field">Job link<input value={value.jobUrl} onChange={(event) => setValue({ ...value, jobUrl: event.target.value })} placeholder="https://company.example/jobs/..." /></label>
          <label>Profile<select value={value.profile} onChange={(event) => setValue({ ...value, profile: event.target.value })}>{profiles.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</select></label>
          <label>Applied on<input type="date" value={value.appliedDate} onChange={(event) => setValue({ ...value, appliedDate: event.target.value })} /></label>
          <label>Job ID<input value={value.jobId} onChange={(event) => setValue({ ...value, jobId: event.target.value })} placeholder="Optional" /></label>
          <label>Status<select value={value.status} onChange={(event) => setValue({ ...value, status: event.target.value as JobRow["status"] })}><option value="applied">applied</option><option value="application_received">application received</option><option value="interview">interview</option><option value="needs_review">needs review</option></select></label>
          <label className="wide-field">Job description<textarea value={value.jobDescription} onChange={(event) => setValue({ ...value, jobDescription: event.target.value })} placeholder="Paste the responsibilities and requirements you want the writing and research steps to use." /></label>
          <label className="wide-field">Notes<textarea value={value.notes} onChange={(event) => setValue({ ...value, notes: event.target.value })} placeholder="Optional follow-up notes" /></label>
        </div>
        {error && <div className="wizard-error">{error}</div>}
        <footer><button className="ghost-button" onClick={onClose}>Cancel</button><button className="launch-button" onClick={save}><Plus size={16} /> Add to Jobs</button></footer>
      </section>
    </div>
  );
}
