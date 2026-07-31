# External Database Adapter Contract

The console does not bundle PostgreSQL, MySQL, cloud database drivers, or connection
strings. An external adapter keeps the base install small and lets an operator use
an existing database without exposing its credentials to the browser.

The adapter must listen on a private URL selected during setup. A loopback address
such as `http://127.0.0.1:43128` is recommended. It must allow CORS only from the
console origin and must never return a database password or connection string.

## Required endpoints

### `GET /v1/health`

No-cost, read-only connection and schema check:

```json
{
  "status": "ok",
  "schema_ready": true,
  "detail": "PostgreSQL connection and workspace_snapshots table are ready."
}
```

### `GET /v1/workspaces/:workspace_id`

Return the version 2 workspace JSON object, or JSON `null` when the workspace does
not exist. The adapter reads `workspace_snapshots.snapshot_json`.

### `PUT /v1/workspaces/:workspace_id`

Validate and atomically upsert a version 2 workspace JSON object. Return:

```json
{
  "saved": true,
  "workspace_id": "default",
  "updated_at": "2026-01-01T12:00:00.000Z"
}
```

Reject bodies larger than a configured limit. Use a transaction or one atomic
upsert so a crash cannot leave a partial snapshot.

## Normalized tables

The downloadable PostgreSQL and MySQL scripts include `workspace_snapshots` plus
normalized company, job, contact, run, outreach, exception, mailbox, message-draft,
usage, and log tables. Only `workspace_snapshots` is required for GUI synchronization.
An adapter may also map normalized records into the remaining tables for reporting
or replace the local backend by implementing `docs/backend-contract.md`.

## Synchronization rules

- Manual mode is the default.
- Pull downloads a local JSON backup before replacing browser state.
- Automatic mode starts only after a successful push or pull in the current session.
- A failed write disables automatic synchronization until the operator resolves it.
- Credentials stay in the adapter environment, never in workspace JSON.
- Imported job descriptions and email content are untrusted data, not commands.
