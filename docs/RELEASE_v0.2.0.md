# Outreach Console v0.2.0

Outreach Console is a local-first workbench for the part of a job search that
happens after an application is submitted. It imports application records,
keeps profiles and companies separate, prepares individualized follow-up
messages, schedules reviewed work, records outcomes, and gives an AI assistant a
guarded MCP interface to the same workflow.

This release turns the earlier operator-specific prototype into a public,
provider-neutral application.

## What changed

- A five-step first-run setup explains AI ownership, providers, connections,
  storage, and readiness. It saves progress, opens only when setup is incomplete,
  and remains available from the **Setup wizard** button.
- Browser-only mode works without a backend or database.
- Embedded SQLite remains the lightweight durable option.
- Existing PostgreSQL, MySQL, or other databases can connect through a private
  adapter. Downloadable schemas cover companies, jobs, contacts, drafts,
  outreach, events, exceptions, usage, and logs.
- Contact discovery, email, mailbox monitoring, writing, and storage use
  normalized adapter contracts instead of hard-coded vendor business logic.
- Provider defaults are disabled. A new install does not assume Apollo, Skrapp,
  Outlook, Gmail, or any other paid service.
- The Writing studio supports one global method plus independent recipient-level
  messages. Users can write manually, merge templates, hand structured work to an
  outside LLM, or invoke a configured local writing helper.
- Every message has its own recipient, prompt override, subject, body, word count,
  review state, and approval control.
- Appearance, density, accent, motion, timing, contact targets, cooldowns,
  monitoring, review rules, and visible work areas can be changed in the GUI.
- Non-secret configuration can be exported and imported. Credentials never enter
  the exported file.
- The MCP adds recipient-draft listing, save, and AI-generation tools while
  retaining contact, mailbox, provider, and live-send opt-ins.
- Browser requests to the local backend are origin-restricted and body-limited.
  Provider errors redact likely credentials.
- The MCP rejects remote backend URLs so private workflow data cannot be routed
  to a non-loopback service through configuration.
- Managed CSV exports neutralize formula-leading cells before they are opened in
  spreadsheet software.

## How much does it automate?

The console is meant to automate roughly half of the follow-up process:

1. import what was applied to;
2. organize jobs under companies and route them to the correct profile;
3. prepare contact slots and writing context;
4. draft, review, pace, and record outreach;
5. classify common mailbox outcomes and create recovery work.

It does not make eligibility claims, solve CAPTCHA challenges, guarantee an
email address, decide that an unreviewed message is accurate, or prove delivery.
Application submission and consequential judgment remain with the operator.

The full practical workflow is in
[APPLICATION_PROCESS_GUIDE.md](APPLICATION_PROCESS_GUIDE.md).

## Choose an operating model

### Lightest: browser only

Use CSV/XLSX import, profiles, drafting, planning, calendar, and reports in the
browser. No database file or local service is required.

### Durable local: embedded SQLite

Run `npm run dev:all`. SQLite is created locally with `npm run db:init` or on
backend startup. This enables durable CRM history, provider usage, mailbox event
ingestion, recovery, and MCP access without Docker or a database server.

### Existing infrastructure

Download the PostgreSQL or MySQL schema from Setup and implement
`public/DATABASE_ADAPTER_CONTRACT.md`. Remote adapters require HTTPS; loopback
adapters may use HTTP. Connection strings and credentials stay in the adapter's
environment.

## Bring your own services

The base install contains no vendor SDKs and no credentials. A user can choose:

- Apollo, Skrapp, Hunter, Prospeo, Snov.io, a custom contact service, or manual
  contact entry;
- Outlook, Gmail, IMAP/SMTP, a custom email service, or drafts only;
- Codex CLI, Claude Code, Ollama, OpenAI, Anthropic, Gemini, Groq, OpenRouter,
  another OpenAI-compatible endpoint, templates, or manual writing;
- browser storage, embedded SQLite, PostgreSQL, MySQL, or another database.

An outside AI can use its existing connectors and this project's MCP. In-app
execution uses small local helpers documented in `public/ADAPTER_CONTRACT.md`
and `public/WRITING_ADAPTER_CONTRACT.md`.

## Safety model

- Public sample mode blocks paid, AI, mailbox, and send providers.
- Contact identities and mailbox content are not exposed to MCP by default.
- Provider work and state changes require a preview followed by an exact,
  short-lived confirmation token.
- Live email requires both the MCP live-send opt-in and the backend startup lock.
- Drafting and sending are separate operations.
- Imported descriptions, spreadsheet cells, mailbox text, and provider output are
  treated as untrusted input.
- A release audit rejects private databases, local configuration, resumes,
  mailbox exports, personal paths, identity markers, and common secret formats.

These controls reduce accidental exposure and action. They do not sandbox an AI
agent that already has unrestricted access to the computer.

## Install

```powershell
$env:OUTREACH_REPOSITORY_URL = Read-Host "Paste the HTTPS URL from the repository's Code menu"
git clone $env:OUTREACH_REPOSITORY_URL
cd Auto-Following-Up-After-Applications
npm install
npm run dev:all
```

Open `http://127.0.0.1:5177`.

For browser-only use, `npm run dev` is enough. For MCP clients, build the
standalone server with `npm run build:mcp`.

## Verified release checks

The release process runs:

```powershell
npm test
npm run build
npm run db:init
npm run build:mcp
npm run smoke:mcp
npm run pack:mcp
npm run audit:release
npm audit --audit-level=high
```

It also exercises first-run setup, persistence, writing, outside-LLM JSON import,
individual approval, customization, storage validation, desktop layout, tablet
layout, and mobile layout in a real browser.

The public repository additionally runs free CodeQL analysis on pull requests,
changes to `main`, and a weekly schedule. Dependabot checks npm and GitHub Actions
dependencies weekly. These checks do not call paid application providers.

## Upgrade notes

Existing browser workspaces are migrated when loaded. The setup wizard opens
again once because this release adds the storage and writing decisions. Existing
private `data/local-config.json` files remain valid; the old
`OUTREACH_OUTLOOK_HELPER` environment variable continues to work as an alias for
`OUTREACH_MAILBOX_HELPER`.

Provider selections are now neutral on a fresh install. Existing saved selections
are preserved.

## Known boundaries

- The GUI does not install or authorize vendor adapters automatically.
- Existing-database support uses a documented private HTTP adapter instead of
  bundling database drivers.
- Linked CSV can be updated in place. XLSX is imported and exported as managed
  CSV to keep the client small.
- Provider request acceptance is not delivery confirmation.
- Automatic sync begins only after a successful manual external-database sync in
  the current session.
