import { UserPlus, X } from "lucide-react";
import { useState } from "react";
import type { JobRow } from "../types";

export interface ManualContactInput { name: string; title: string; email: string }

export function ManualContactModal({ job, onClose, onSave }: { job: JobRow; onClose: () => void; onSave: (value: ManualContactInput) => void }) {
  const [value, setValue] = useState<ManualContactInput>({ name: "", title: "", email: "" });
  const valid = value.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim());
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="manual-contact-modal" role="dialog" aria-modal="true" aria-labelledby="manual-contact-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="eyebrow">Manual contact entry</span><h2 id="manual-contact-title">Add a contact for {job.company}</h2></div><button className="icon-button" title="Close" onClick={onClose}><X size={18} /></button></header>
      <p>This creates one real recipient slot for {job.roleTitle}. It does not call a provider or spend credits.</p>
      <div className="manual-contact-fields">
        <label>Name<input autoFocus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder="Taylor Morgan" /></label>
        <label>Title<input value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} placeholder="Talent Acquisition Partner" /></label>
        <label>Email<input type="email" value={value.email} onChange={(event) => setValue({ ...value, email: event.target.value })} placeholder="taylor@example.com" /></label>
      </div>
      <footer><button className="ghost-button" onClick={onClose}>Cancel</button><button className="continue-button" disabled={!valid} onClick={() => onSave({ name: value.name.trim(), title: value.title.trim(), email: value.email.trim().toLowerCase() })}><UserPlus size={16} /> Add contact</button></footer>
    </section>
  </div>;
}
