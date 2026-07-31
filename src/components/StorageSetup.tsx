import { Database, Globe2, HardDrive, ShieldCheck } from "lucide-react";
import type { StorageSettings } from "../types";

interface StorageSetupProps {
  value: StorageSettings;
  onChange: (value: StorageSettings) => void;
  compact?: boolean;
  status?: string;
  onTest?: () => void;
  onPull?: () => void;
  onPush?: () => void;
}

export function StorageSetup({ value, onChange, compact = false, status = "", onTest, onPull, onPush }: StorageSetupProps) {
  return (
    <section className={`storage-setup ${compact ? "compact" : ""}`}>
      <div><h3>Choose how history is stored</h3><p>Credentials and connection strings never belong in this screen. Store them in the environment used by the local adapter.</p></div>
      <div className="storage-mode-options" role="group" aria-label="Storage mode">
        <button className={value.mode === "browser" ? "active" : ""} onClick={() => onChange({ ...value, mode: "browser" })}><Globe2 size={18} /><span><strong>Browser only</strong><small>No database file. Imports, drafts, preferences, and reports stay in this browser.</small></span></button>
        <button className={value.mode === "sqlite" ? "active" : ""} onClick={() => onChange({ ...value, mode: "sqlite" })}><HardDrive size={18} /><span><strong>Embedded SQLite</strong><small>Recommended for durable CRM, mailbox, recovery, and audit history. No database server.</small></span></button>
        <button className={value.mode === "external" ? "active" : ""} onClick={() => onChange({ ...value, mode: "external" })}><Database size={18} /><span><strong>Existing database</strong><small>Use PostgreSQL, MySQL, or another database through a private adapter.</small></span></button>
      </div>
      {value.mode === "browser" && <div className="storage-detail"><ShieldCheck size={16} /><span><strong>Lightest mode</strong> Queue planning and individualized writing work without a backend. Company CRM, mailbox ingestion, and recovery automation remain unavailable until a backend is connected.</span></div>}
      {value.mode === "sqlite" && <div className="storage-fields"><label>Local database path<input value={value.sqlitePath} onChange={(event) => onChange({ ...value, sqlitePath: event.target.value })} /></label><div className="storage-detail"><ShieldCheck size={16} /><span>The backend creates and migrates all tables automatically. This path is ignored by Git.</span></div></div>}
      {value.mode === "external" && <div className="storage-fields">
        <label>Database family<select value={value.externalDialect} onChange={(event) => onChange({ ...value, externalDialect: event.target.value as StorageSettings["externalDialect"], externalSchemaReady: false })}><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL / MariaDB</option><option value="other">Other through adapter</option></select></label>
        <label>Private adapter URL<input type="url" value={value.externalAdapterUrl} onChange={(event) => onChange({ ...value, externalAdapterUrl: event.target.value })} placeholder="http://127.0.0.1:43128" /></label>
        <label>Workspace ID<input value={value.externalWorkspaceId} onChange={(event) => onChange({ ...value, externalWorkspaceId: event.target.value.replace(/[^a-zA-Z0-9_-]/g, "") })} /></label>
        <label>Synchronization<select value={value.externalSyncMode} onChange={(event) => onChange({ ...value, externalSyncMode: event.target.value as StorageSettings["externalSyncMode"] })}><option value="manual">Manual push / pull</option><option value="automatic">Automatic after first successful sync</option></select></label>
        <div className="schema-actions"><a className="small-button" href={`/database/${value.externalDialect === "mysql" ? "mysql" : "postgresql"}.sql`} download>Download table schema</a><a className="small-button" href="/DATABASE_ADAPTER_CONTRACT.md" target="_blank" rel="noreferrer">Adapter contract</a></div>
        <label className="toggle-row"><input type="checkbox" checked={value.externalSchemaReady} onChange={(event) => onChange({ ...value, externalSchemaReady: event.target.checked })} /><span><strong>I created or mapped the required tables</strong><small>The adapter connection test will still verify the schema before use.</small></span></label>
        {(onTest || onPull || onPush) && <div className="schema-actions"><button className="small-button" onClick={onTest}>Test adapter</button><button className="small-button" onClick={onPull}>Pull (backs up local)</button><button className="small-button" onClick={onPush}>Push current workspace</button></div>}
        {status && <div className="storage-detail"><ShieldCheck size={16} /><span>{status}</span></div>}
      </div>}
    </section>
  );
}
