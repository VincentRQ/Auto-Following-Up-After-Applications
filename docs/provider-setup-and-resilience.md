# Provider Setup and Resilience

The console configures workflow roles rather than assuming a fixed vendor stack:

1. Primary contact discovery
2. Optional fallback contact discovery
3. Email, drafts, and reply ingestion

The first-run setup flow currently offers Apollo, Skrapp, Hunter, Prospeo,
Snov.io, Gmail, Microsoft Outlook, IMAP/SMTP mail, and custom providers. A
selection is not the same as a connection. The public source release provides a
provider bridge but deliberately does not bundle vendor helper code or OAuth
clients. Every selected provider remains `adapter-required` until a compatible
local adapter is installed and verified.

## Credential Boundary

The browser stores provider names, enabled roles, and environment-variable
names. It never stores API keys, passwords, OAuth refresh tokens, or mailbox
content. Actual credentials belong in the environment or private credential
store used to launch the backend.

Setup preferences are written atomically to `data/local-config.json`. Existing
profile, resume, and helper settings are preserved.
Non-secret GUI preferences can be exported and imported independently of local
credentials and absolute helper paths.

## Recovery Behavior

- Setup progress is saved after every change and can resume at the last step.
- Closing setup does not erase selections.
- `Do not open setup automatically again` suppresses the modal, but not the
  visible incomplete-setup reminder.
- Read-only backend requests time out after 10 seconds and retry once. Mutating
  requests are never retried automatically because duplicate writes are worse
  than a visible failure.
- Dashboard refreshes are independent. A mailbox failure does not clear CRM,
  statistics, recovery cases, or setup data that loaded successfully.
- Invalid browser storage is copied to a recovery entry before defaults are
  loaded.
- A top-level error boundary preserves stored work and offers a clean reload if
  React cannot render the console.
- Provider checks return per-area errors. One failed adapter does not hide the
  status of the others.
- The backend rejects unapproved browser origins, oversized request bodies, and
  malformed JSON before service logic runs.
- External database pull creates a local backup, and automatic synchronization
  stops after an adapter error.

## Intentional Boundary

This is not a dynamic code downloader. Selecting an unsupported service does
not install or execute third-party code. A provider adapter must be reviewed,
installed locally, and tested before its status can become operational. This
keeps customization broad without turning a lightweight local console into a
fragile plugin host.

## Release Gates

- Run synthetic fixtures for enrichment, mailbox, writing, and storage adapters.
- Preserve idempotency and confirmation gates before adding any automatic retry.
- Validate setup, file permissions, schema readiness, helper versions, and account
  routing without spending provider credits.
- Keep public sample mode as an absolute paid, AI, and email provider lock.
