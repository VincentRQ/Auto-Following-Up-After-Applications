# Workflow

1. Import a workbook containing applications.
2. Select a profile.
3. Add or delete profiles when a different resume/persona is needed.
4. Select jobs to include in the outreach batch.
5. Add the batch template, target rules, and AI send quirks in natural language.
6. Pick a start date/time and spacing in seconds.
7. Launch the batch.
8. Review the run report for clean sends, skipped rows, and contact-quality issues.
9. Use the debug view for import, profile, contact-quality, and adapter-state issues.

## Operational Controls

- Dry run: builds the queue, validates rows, and creates a report in the browser.
- Backend submit: sends only ready queue rows to the configured local backend.
- Run-plan export: downloads the backend-ready plan for inspection or replay.
- Report export: downloads JSON or CSV after a run.
- Workspace persistence: imported rows, profiles, instructions, backend URL, and recent reports are stored in browser local storage.
- Workspace export/import: save or restore a full operator state as JSON.
- Queue review: inspect ready, blocked, and already-sent rows before launch.
- Job editor: select a row to correct imported data without editing the source workbook.

## Status Colors

- Recent: recently worked or recently applied.
- Sent: outreach already sent.
- Queued: selected for the next batch.
- Needs review: missing URL, company, role, or contact confidence.
- Skipped: excluded from the launch.

## Adapter Boundary

The GUI should not directly contain mailbox credentials or enrichment keys.
Production adapters should be implemented as a local backend with explicit
operator configuration.

The GUI passes instructions to that backend. The backend/AI layer should own the
actual interpretation of those instructions because it has access to the richer
context, contact search results, email history, and provider-specific failures.
