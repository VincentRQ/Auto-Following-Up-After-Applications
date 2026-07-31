# Outreach Console MCP v0.1.1

This first MCP release connects an AI assistant to the same local backend used
by the Outreach Console GUI. It is intended for people who track job
applications in CSV/XLSX files, research a small set of relevant internal
contacts, draft recruiter follow-ups, and maintain recovery rules for bounces,
OOO referrals, replies, and interview requests.

## What This Release Does

- Reads backend health, profile routing, resume readiness, provider status,
  application outcomes, activity averages, provider usage, company history,
  recovery cases, incident reports, and persisted run plans.
- Imports normalized applications into the company-centric local database.
- Builds deterministic shadow batches without sending email.
- Calls configured enrichment through a compatible local provider adapter.
- Reads configured mailboxes and applies only the backend's
  high-confidence application/recovery matches.
- Creates profile-routed Outlook drafts.
- Sends one reviewed email when every live-send gate is enabled.
- Pauses company outreach and resolves recovery cases.

The MCP server is a thin control surface. It does not reimplement contact
ranking, account routing, mailbox classification, duplicate prevention, or
recovery rules. Those stay in the tested backend.

## Defaults

The default configuration is deliberately limited:

| Capability | Default | Setting |
| --- | --- | --- |
| Aggregate health, setup, dashboard, companies, and exceptions | On | none |
| Recruiter names and email addresses | Off | `OUTREACH_MCP_EXPOSE_CONTACTS=1` |
| Mailbox senders and message previews | Off | `OUTREACH_MCP_EXPOSE_MAILBOX=1` |
| Apollo, Skrapp, and Outlook calls | Off | `OUTREACH_MCP_ENABLE_PROVIDER_ACTIONS=1` |
| Live email sends | Off | `OUTREACH_MCP_ENABLE_LIVE_SEND=1` |
| Backend live sends | Off | `OUTREACH_LIVE_SEND=1` on the backend |

Public sample mode overrides all provider and send settings.

## Confirmation Protocol

MCP has no portable native confirmation dialog. Any tool that imports data,
changes state, spends credits, reads a mailbox, creates a draft, or sends email
therefore uses two calls:

1. Call the tool without `confirm`. It returns a human-readable preview and a
   short-lived `confirmToken`. Nothing runs.
2. Show the preview to the user. Only after explicit approval, call the same
   tool again with the same arguments and that token.

Tokens are held only in memory, expire after two minutes, are single-use, and
are cryptographically bound to the action and exact normalized arguments.
Changing the recipient, body, company, job, credit flag, or any other argument
invalidates the token.

## Data Flow

1. The MCP client sends tool arguments to the local stdio MCP process.
2. The MCP process calls the configured localhost backend.
3. The backend reads/writes local SQLite and, when enabled, invokes the configured
   local enrichment or mailbox adapter.
4. Tool results return to the MCP client and become part of the AI conversation.

The MCP server has no hosted backend and collects no telemetry. The AI provider
can see tool arguments and returned results. This is why contact and mailbox
surfaces are separate opt-ins and list results are capped.

## Authentication

Authentication is out of band:

- Outlook accounts are authorized through the operator's configured Microsoft Graph helper.
- Apollo and Skrapp credentials remain in the operator's private adapter environment.
- AI-provider credentials remain in environment variables or their local CLI
  login stores.

There is no MCP login tool and no credential argument. Do not paste API keys,
passwords, refresh tokens, or authorization codes into a prompt.

## Installation Paths

### Source checkout

```powershell
npm install
npm run dev:backend
npm run mcp
```

### Standard MCP client

```powershell
npm run build:mcp
```

Register `node /absolute/path/to/dist/outreach-mcp.js` and set
`OUTREACH_MCP_BACKEND_URL` if the backend is not on `127.0.0.1:43127`.

### Codex plugin

The repository includes `.codex-plugin/plugin.json` and `.mcp.json`. The wrapper
runs the checked-in standalone bundle and does not require an MCP-specific
`node_modules` tree after `npm run build:mcp`.

### Claude Desktop extension

```powershell
npm run pack:mcp
```

This validates and packs `outreach-console-mcp.mcpb`. The GUI/backend still
needs to be installed and running locally; the extension does not bundle private
configuration, resumes, provider helpers, OAuth clients, or credentials.

## Tool Catalog

Read-only by default:

- `outreach_health`
- `outreach_setup_status`
- `outreach_provider_check`
- `outreach_dashboard`
- `outreach_list_companies`
- `outreach_list_exceptions`
- `outreach_incident_report`
- `outreach_get_run`

Contact PII opt-in:

- `outreach_get_company`
- `outreach_create_draft`
- `outreach_send_email`

Mailbox content opt-in:

- `outreach_mailbox_events`
- `outreach_sync_mailbox`

Confirmed state/provider actions:

- `outreach_import_applications`
- `outreach_submit_shadow_batch`
- `outreach_enrich_company`
- `outreach_set_company_suppression`
- `outreach_resolve_exception`

## Practical Limits

- The backend must already be running. v0.1.1 does not start or install it from
  inside MCP.
- MCP setup checks report adapter readiness but do not authorize accounts or install helpers.
- XLSX parsing and linked-file synchronization remain GUI workflows.
- Draft and send tools operate one reviewed message at a time. Batch pacing and
  post-send monitoring remain backend/operator workflows.
- A Graph success is not delivery confirmation.
- A coding agent with unrestricted shell access can bypass MCP-layer controls.
- The public repository must not include real resumes, contact exports, mailbox
  data, provider keys, private SQLite databases, or local configuration.

## Uninstall And Cleanup

1. Remove the MCP/plugin entry from the client.
2. Stop the local backend and GUI processes.
3. Delete `data/outreach.sqlite` only if local CRM history should be erased.
4. Delete `data/local-config.json` to remove local routing paths.
5. Revoke Outlook authorization through the Graph helper or Microsoft account
   settings if access should be invalidated.
6. Revoke Apollo/Skrapp keys in those providers if they are no longer used.

Removing the MCP wrapper alone does not delete the local database, revoke
provider credentials, or remove Outlook authorization.

## Development And QA

```powershell
npm test
npm run build
npm run build:mcp
npm run smoke:mcp
```

Tests cover the GUI libraries, backend routes and synthetic provider adapters,
confirmation token binding/expiry, privacy defaults, and stdio MCP discovery.
No live provider call is needed for the test suite.
