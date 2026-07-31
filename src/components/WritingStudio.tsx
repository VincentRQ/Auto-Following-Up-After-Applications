import { Check, Clipboard, FileJson, Pencil, RefreshCw, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { JobRow, MessageDraft, ProfileDefinition, WritingPreferences } from "../types";
import { applyGeneratedMessages, buildLlmWritingBrief, prepareMessageDrafts, updateMessageDraft, wordCount } from "../lib/drafts";

interface WritingStudioProps {
  selectedJobs: JobRow[];
  jobs: JobRow[];
  drafts: MessageDraft[];
  profiles: ProfileDefinition[];
  activeProfile: string;
  contactTarget: number;
  preferences: WritingPreferences;
  onPreferences: (value: WritingPreferences) => void;
  onDrafts: (value: MessageDraft[]) => void;
  onGenerate: (brief: string, drafts: MessageDraft[]) => Promise<Array<{ draft_id: string; subject: string; body: string }>>;
}

export function WritingStudio({
  selectedJobs,
  jobs,
  drafts,
  profiles,
  activeProfile,
  contactTarget,
  preferences,
  onPreferences,
  onDrafts,
  onGenerate,
}: WritingStudioProps) {
  const selectedIds = useMemo(() => new Set(selectedJobs.map((job) => job.id)), [selectedJobs]);
  const visibleDrafts = selectedIds.size
    ? drafts.filter((draft) => selectedIds.has(draft.jobRowId))
    : drafts.filter((draft) => draft.profile === activeProfile);
  const [activeId, setActiveId] = useState("");
  const [generatedJson, setGeneratedJson] = useState("");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const active = visibleDrafts.find((draft) => draft.id === activeId) ?? visibleDrafts[0] ?? null;
  const activeJob = active ? jobs.find((job) => job.id === active.jobRowId) : undefined;

  function prepare() {
    const selectedProfile = profiles.find((profile) => profile.key === selectedJobs[0]?.profile);
    const retained = drafts.filter((draft) => !selectedIds.has(draft.jobRowId));
    const prepared = prepareMessageDrafts(selectedJobs, visibleDrafts, contactTarget, preferences, selectedProfile?.senderName ?? "", selectedProfile?.notes ?? "relevant work in the field");
    onDrafts([...retained, ...prepared]);
    setActiveId(prepared[0]?.id ?? "");
    setMessage(`${prepared.length} individual message slots prepared.`);
  }

  async function copyBrief() {
    if (!visibleDrafts.length) return;
    const brief = buildLlmWritingBrief(visibleDrafts, preferences, profiles);
    try {
      await navigator.clipboard.writeText(brief);
      setMessage("AI writing brief copied. Paste the returned JSON below.");
    } catch {
      setMessage("Clipboard access was unavailable. Use Export workspace or select the text manually.");
    }
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(generatedJson) as Array<{ draft_id?: string; id?: string; subject?: string; body?: string }>;
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
      onDrafts(applyGeneratedMessages(drafts, parsed, preferences));
      setMessage(`${parsed.length} generated message updates applied for review.`);
      setGeneratedJson("");
    } catch (error) {
      setMessage(error instanceof Error ? `Generated response was not applied: ${error.message}` : "Generated response was not applied.");
    }
  }

  async function generateInApp() {
    if (!visibleDrafts.length) return;
    setGenerating(true);
    setMessage("");
    try {
      const brief = buildLlmWritingBrief(visibleDrafts, preferences, profiles);
      const generated = await onGenerate(brief, visibleDrafts);
      onDrafts(applyGeneratedMessages(drafts, generated, preferences));
      setMessage(`${generated.length} messages generated. Review every message before approval.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The configured AI adapter could not generate messages.");
    } finally {
      setGenerating(false);
    }
  }

  function updateActive(update: Partial<MessageDraft>) {
    if (!active) return;
    const selectedProfile = profiles.find((profile) => profile.key === active.profile);
    onDrafts(drafts.map((draft) => draft.id === active.id ? updateMessageDraft(draft, update, preferences, activeJob, selectedProfile?.senderName ?? "", selectedProfile?.notes ?? "relevant work in the field") : draft));
  }

  function approveActive() {
    if (!active || active.status === "needs_recipient" || active.status === "needs_writing") {
      setMessage("Add a valid recipient, subject, and body before approval.");
      return;
    }
    updateActive({ status: "approved" });
    setMessage("Message approved locally. Sending still requires the separate provider approval gate.");
  }

  return (
    <section className="writing-studio">
      <header className="studio-heading">
        <div><span className="eyebrow">Individualized outreach</span><h2>Writing studio</h2></div>
        <div className="studio-actions">
          <button className="small-button" onClick={prepare} disabled={!selectedJobs.length}><Users size={15} /> Prepare selected</button>
          <button className="small-button" onClick={() => void copyBrief()} disabled={!visibleDrafts.length}><Clipboard size={15} /> Copy AI brief</button>
          {preferences.mode === "in_app_llm" && <button className="small-button" onClick={() => void generateInApp()} disabled={!visibleDrafts.length || generating}><Sparkles size={15} /> {generating ? "Generating..." : "Generate"}</button>}
        </div>
      </header>

      <div className="writing-global">
        <label>Writing method
          <select value={preferences.mode} onChange={(event) => onPreferences({ ...preferences, mode: event.target.value as WritingPreferences["mode"] })}>
            <option value="external_llm">Outside AI / LLM</option>
            <option value="in_app_llm">Configured in-app AI</option>
            <option value="template">Template merge</option>
            <option value="manual">Write manually</option>
          </select>
        </label>
        <label>Maximum body words
          <input type="number" min="20" max="500" value={preferences.maximumWords} onChange={(event) => onPreferences({ ...preferences, maximumWords: Number(event.target.value) })} />
        </label>
        <label className="wide-setting">Global writing prompt
          <textarea value={preferences.globalPrompt} onChange={(event) => onPreferences({ ...preferences, globalPrompt: event.target.value })} />
        </label>
        <label>Subject template
          <input value={preferences.subjectTemplate} onChange={(event) => onPreferences({ ...preferences, subjectTemplate: event.target.value })} />
        </label>
        <label className="template-body">Body template
          <textarea value={preferences.bodyTemplate} onChange={(event) => onPreferences({ ...preferences, bodyTemplate: event.target.value })} />
        </label>
        <label className="toggle-row compact-toggle"><input type="checkbox" checked={preferences.requireIndividualReview} onChange={(event) => onPreferences({ ...preferences, requireIndividualReview: event.target.checked })} /><span><strong>Review every message</strong><small>Recommended even when an LLM writes the first draft.</small></span></label>
      </div>

      {!visibleDrafts.length ? (
        <div className="empty-state">
          {selectedJobs.length
            ? "No message slots have been prepared for this selection. Choose Prepare selected to create them."
            : "Select one or more jobs, then prepare individual message slots."}
        </div>
      ) : (
        <div className="draft-workspace">
          <div className="draft-list" aria-label="Individual messages">
            {visibleDrafts.map((draft) => (
              <button key={draft.id} className={active?.id === draft.id ? "active" : ""} onClick={() => setActiveId(draft.id)}>
                <span>{draft.company}</span>
                <strong>{draft.recipientName || `Contact ${draft.slot}`}</strong>
                <small>{draft.status.replaceAll("_", " ")}</small>
              </button>
            ))}
          </div>
          {active && <div className="draft-editor">
            <header><div><strong>{active.company}</strong><span>{active.roleTitle}{active.jobId ? ` / ${active.jobId}` : ""}</span></div><span className={`draft-state ${active.status}`}>{active.status.replaceAll("_", " ")}</span></header>
            <div className="draft-recipient-grid">
              <label>Name<input value={active.recipientName} onChange={(event) => updateActive({ recipientName: event.target.value })} /></label>
              <label>Title<input value={active.recipientTitle} onChange={(event) => updateActive({ recipientTitle: event.target.value })} /></label>
              <label>Email<input type="email" value={active.recipientEmail} onChange={(event) => updateActive({ recipientEmail: event.target.value })} /></label>
              <label>Method<select value={active.mode} onChange={(event) => updateActive({ mode: event.target.value as MessageDraft["mode"] })}><option value="external_llm">Outside AI</option><option value="in_app_llm">In-app AI</option><option value="template">Template</option><option value="manual">Manual</option></select></label>
            </div>
            <label>Individual instructions<textarea value={active.promptOverride} onChange={(event) => updateActive({ promptOverride: event.target.value })} placeholder="Optional context or tone for only this recipient" /></label>
            <label>Subject<input value={active.subject} onChange={(event) => updateActive({ subject: event.target.value })} /></label>
            <label>Body<textarea className="draft-body" value={active.body} onChange={(event) => updateActive({ body: event.target.value })} /></label>
            <footer>
              <span className={wordCount(active.body) > preferences.maximumWords ? "over-limit" : ""}>{wordCount(active.body)} / {preferences.maximumWords} words</span>
              <button className="small-button" onClick={() => updateActive({ body: "", status: "needs_writing" })}><RefreshCw size={14} /> Clear copy</button>
              <button className="launch-button" onClick={approveActive}><Check size={15} /> Approve message</button>
            </footer>
          </div>}
        </div>
      )}

      {preferences.mode === "external_llm" && <details className="generated-import">
        <summary><FileJson size={14} /> Apply JSON returned by an outside AI</summary>
        <p>Use the copied brief. Paste only its JSON array response here; each entry is matched by <code>draft_id</code>.</p>
        <textarea value={generatedJson} onChange={(event) => setGeneratedJson(event.target.value)} placeholder='[{"draft_id":"row::1","subject":"...","body":"..."}]' />
        <button className="small-button" onClick={applyJson} disabled={!generatedJson.trim()}><Pencil size={14} /> Apply for review</button>
      </details>}
      {message && <div className="studio-message" role="status">{message}</div>}
    </section>
  );
}
