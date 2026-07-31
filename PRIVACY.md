# Privacy

Outreach Console and its MCP server run locally. The project has no hosted
service and sends no telemetry to its authors.

## Data Stored Locally

- Browser-only workspaces store application rows, message drafts, preferences, and
  reports in IndexedDB/local storage.
- With SQLite enabled, company, contact, outreach, exception, mailbox-event,
  message-draft, provider-usage, and system-log records are stored in
  `data/outreach.sqlite`.
- An external database adapter receives the versioned workspace snapshot only after
  the operator configures its private URL and initiates synchronization.
- Profile routing and local resume/helper paths are stored in
  `data/local-config.json` when private operator mode is configured.
- Provider work files may be created temporarily under `data/provider-work/`.

These paths are ignored by git.

## Public Samples

The repository includes only `data/sample-applications.csv` and
`data/sample-recruiter-contacts.csv` as public data. Both are synthetic, use a
Customer Success demonstration profile, and use the reserved `.invalid` domain
for every email address and link. They contain no exported recruiter history.

A filename or row count that reappears when the GUI restarts is restored from that
browser's IndexedDB/local storage. It is not embedded in the JavaScript build and
does not travel with a Git clone or release. The Data Source view labels restored
imports as a private local workspace and labels the bundled demonstration rows as
synthetic public data.

Public sample mode always uses an in-memory backend database. It does not open an
existing `data/outreach.sqlite` file or an `OUTREACH_DATABASE` path.

## Data Sent Elsewhere

When enabled, the backend can send search parameters to the selected contact
provider, mail operations to the selected email provider, and structured writing
context to the selected AI helper. An outside AI can see MCP tool arguments and
returned tool results as part of the conversation. Consult each provider's privacy
terms for its handling of that data.

Contact identities and mailbox content are not exposed through MCP by default.
They require separate opt-in settings. Credentials are never accepted as tool
arguments and should not be pasted into prompts.

## Retention

The project does not impose a retention schedule. The local operator controls
browser storage, SQLite, external storage, and private configuration. Deleting the
application does not automatically revoke provider authorization or API keys.
