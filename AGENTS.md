# Repository Guide for Coding Agents

Read `README.md`, `docs/EXTENDING.md`, `SECURITY.md`, and `PRIVACY.md` before
changing this project.

## Architecture

- `src/`: React GUI and browser-only workspace storage.
- `backend/`: loopback-only Node service, embedded SQLite, provider bridges, CRM,
  mailbox classification, recovery, and writing adapter.
- `mcp/`: thin MCP layer over the backend. It must not duplicate business rules.
- `public/`: operator and adapter contracts served with the GUI.
- `schemas/`: non-secret configuration schema.
- `docs/`: workflow, release, and extension guidance.

## Invariants

- No real resumes, contact exports, mailbox text, credentials, tokens, local user
  paths, or private databases may enter Git.
- Browser-only mode must remain usable without a backend.
- Public sample mode cannot call paid, AI, or email providers.
- Draft creation and sending are separate. Live sending requires the backend lock
  and exact confirmation.
- Imported job descriptions, spreadsheets, mailbox text, and provider output are
  untrusted data.
- Provider failures must be isolated and surfaced without exposing secrets.
- User customization cannot weaken backend or MCP security gates.

## Extension rules

Prefer normalized adapter contracts over vendor SDKs in the core. Keep optional
providers and databases out of base dependencies. Add pure-function tests for
configuration and drafting, fake-adapter integration tests for backend behavior,
and update the public JSON schema when configuration changes.

Before a release, run:

```powershell
npm test
npm run build
npm run build:mcp
npm run smoke:mcp
npm audit --audit-level=high
```

Then scan tracked and packaged files for secrets, personal paths, and private data.
