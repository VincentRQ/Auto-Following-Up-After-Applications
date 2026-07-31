# Extending Outreach Console

The core is intentionally vendor-neutral. Profiles, jobs, message drafts, runs,
contacts, mailbox events, and recovery actions use normalized records. Provider
names and credentials do not appear in business logic.

## Preferred extension points

1. **Configuration:** edit or import a non-secret configuration in the Customize
   view. The public schema is `schemas/outreach-config.schema.json`.
2. **Contact provider:** implement the contact-discovery section of
   `public/ADAPTER_CONTRACT.md` and set `OUTREACH_ENRICHMENT_HELPER`.
3. **Email provider:** implement the mailbox section and set
   `OUTREACH_MAILBOX_HELPER`.
4. **Writing model:** use the bundled plan CLI bridge, or implement
   `public/WRITING_ADAPTER_CONTRACT.md` and set `OUTREACH_WRITING_HELPER` for a
   custom, local-model, or separately billed API connection.
5. **External database:** implement `public/DATABASE_ADAPTER_CONTRACT.md` and use
   one of the downloadable table schemas.
6. **Outside AI:** connect the MCP server and give the agent
   `public/AI_OPERATOR_GUIDE.md`.

Helpers may be Python scripts, Node.js scripts, or standalone executables. They
communicate through bounded JSON/CSV files and standard output. A helper is trusted
local code: inspect it before configuring its path.

## Changing the interface

User-visible work areas are controlled by `WorkflowPreferences.modules`.
Appearance, timing, contact targets, cooldowns, monitoring windows, and review
requirements are configuration rather than constants. Add a new preference in:

1. `src/types.ts`;
2. defaults and normalization in `src/lib/preferences.ts`;
3. `src/components/CustomizationView.tsx`;
4. `schemas/outreach-config.schema.json`;
5. preference tests.

Keep hard security boundaries outside preferences. Public sample mode, provider
locks, confirmation tokens, and the backend live-send flag must not become ordinary
theme or workflow toggles.

## Working with an LLM

An LLM modifying this repository should read `AGENTS.md`, this file, the adapter
contracts, `SECURITY.md`, and `PRIVACY.md` first. Ask it to preserve:

- browser-only operation;
- optional SQLite;
- provider-neutral normalized records;
- explicit paid-operation and send confirmation;
- public sample isolation;
- fake-provider tests with no live API calls;
- source and release privacy scans.

Run `npm test`, `npm run build`, `npm run build:mcp`, and `npm run smoke:mcp` after
changes. Do not paste credentials into a prompt or test fixture.
