# Changelog

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
