# Changelog

## 0.4.0 - 2026-07-31

- Added five lightweight CSS background effects plus an Off option, with saved
  preferences and reduced-motion handling.
- Added four editable starter profiles whose order is shuffled once for a fresh
  workspace and then persisted.
- Added dependency-free compatible API writing for Gemini, Groq, OpenRouter,
  DeepSeek, Kimi, Mistral, Together AI, and Cerebras.
- Pinned named API modes to their official HTTPS endpoints, bounded provider
  responses, and added credential-redaction and endpoint-pinning tests.
- Reworked default recruiter copy around a factual job detail, one supplied point
  of fit, an application note, one routing question, and an 80-word ceiling.
- Added over-limit draft blocking, profile-aware template text, and a public
  writing guide based on the supplied short-email framework and Instantly's
  public guidance.
- Added a compact operator skill, platform launchers, and first-run browser opening
  to the Lite package without adding runtime dependencies.
- Added separate one-click Sample Mode launchers so the backend provider lock is
  active before the database opens.
- Made packaged builds use their own loopback origin on custom ports and limited
  Sample Mode browser connections to that same locked service.
- Corrected pre-check sample messaging, restored visible step numbers on narrow
  setup screens, and canceled an older armed timer before an immediate run.
- Closed public-sample connection-check paths, pinned each named API to its own
  credential variable, removed raw provider responses, and tightened mail input
  validation.
- Removed duplicate raw JSON fields from API responses and expanded MCP redaction
  for alternate recipient fields, redirect addresses, and email-shaped values.
- Added recovery for malformed profile and AI settings in local storage and
  imported configuration files.
- Replaced the technical front-page README with a user guide and moved coding-agent
  context into `docs/LLM_OPERATOR_GUIDE.md`.
- Updated MIT ownership to Vincent Quimby and documented the standard notice
  requirement without adding a non-MIT attribution restriction.

## 0.3.1 - 2026-07-31

- Added a structured GitHub bug form and private support-email fallback.
- Renamed the user-facing Report tab to **Run Summary**.
- Added a guarded **Start fresh** flow with a browser-workspace download, optional
  SQLite backup/reset, one-time token, and exact confirmation phrase.
- Preserved source spreadsheets, resumes, credentials, provider configuration,
  CLI logins, external databases, and unrelated browser storage during reset.
- Added frontend and backend regression tests for the reset boundary.
- Added an in-app operating guide and a manual application-entry path for users
  who do not maintain a spreadsheet.
- Added standard `.ics` calendar export with explicit event, range, and reminder
  controls; the app never writes to an external calendar in the background.
- Added keyboard-accessible panel resizing, exact width controls, and additional
  balanced themes and accent choices.
- Added an install-free Lite distribution with no runtime npm dependencies and a
  hard 50 MiB archive budget, plus a packaged-app smoke test and CI size audit.
- Deferred the XLSX parser until an Excel import begins, reducing initial browser
  download and startup work for CSV and manual-entry users.

## 0.3.0 - 2026-07-31

- Added bundled plan-backed writing bridges for ChatGPT/Codex, Claude, Cursor,
  and OpenCode Go.
- Added guided install/sign-in commands and a no-inference login test to first-run
  setup and the Setup panel.
- Prevented plan modes from inheriting provider API-key environment variables and
  restricted generation to temporary, tool-constrained workspaces.
- Added an explicit strict plan-only guard with account-setting links for Cursor
  on-demand usage and OpenCode Zen balance fallback.
- Added Windows npm-shim handling and isolated fake-CLI coverage for auth,
  generation, structured output, and OpenCode model restrictions.
- Replaced public application/contact examples with a synthetic Customer Success
  dataset that uses reserved `.invalid` domains.
- Isolated public sample mode from configured SQLite files by forcing a fresh
  in-memory backend database.
- Added a visible local-data privacy label and release gates that reject workbooks,
  non-sample CSV exports, personal mailbox markers, and private data in Git history.

## 0.2.1 - 2026-07-30

- Fixed clipped Setup diagnostics in the right-side operational panel.
- Kept calendar headings and controls visible on phones while limiting
  horizontal scrolling to the seven-column month grid.
- Revalidated the production UI across desktop, tablet, mobile, light, and
  high-contrast layouts.

## 0.2.0 - 2026-07-30

- Added resumable provider-neutral onboarding.
- Added browser-only, embedded SQLite, and existing-database storage modes.
- Added global and recipient-level manual, template, outside-LLM, and in-app
  writing workflows.
- Added user-configurable appearance, operational defaults, review rules, and
  module visibility.
- Added writing and database adapter contracts and public table schemas.
- Added message-draft persistence and MCP drafting tools.
- Hardened localhost origin handling, request size limits, endpoint validation,
  MCP backend routing, CSV export handling, provider error redaction, and public
  sample locks.
- Added public release auditing and expanded synthetic and browser QA.
- Added CodeQL and Dependabot automation for the public repository.

## 0.1.1 - 2026-07-28

- Patched audited dependency vulnerabilities.

## 0.1.0 - 2026-07-28

- Initial public GUI, backend, and MCP release.
