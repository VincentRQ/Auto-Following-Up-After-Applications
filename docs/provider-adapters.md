# Provider Adapters

Outreach Console is a local workflow application. It ships the queue, CRM,
recovery rules, confirmation gates, MCP control surface, and a small provider
bridge. It intentionally does not ship API keys, OAuth clients, mailbox tokens,
or vendor-specific helper code.

## What A Fresh Install Can Do

Without any provider adapter, the console can import CSV/XLSX data, manage
profiles, run shadow batches, maintain company history and exceptions, replay
runs, export reports, and use public sample mode. Provider actions remain
disabled.

## Configure A Helper

Copy `data/local-config.example.json` to `data/local-config.json`. Configure one
of these portable paths, or provide the equivalent environment variables when
starting the backend:

| Role | Config field | Environment variable | Required behavior |
| --- | --- | --- | --- |
| Contact discovery | `enrichmentHelper` | `OUTREACH_ENRICHMENT_HELPER` | Accepts `--input`, `--output`, `--max-contacts`, `--provider`, and optional `--allow-paid-lookups`; emits the normalized CSV in `ADAPTER_CONTRACT.md`. |
| Discovery health check | `enrichmentSetupHelper` | `OUTREACH_ENRICHMENT_SETUP_HELPER` | Emits JSON and must not spend credits. |
| Mailbox | `mailboxHelper` | `OUTREACH_MAILBOX_HELPER` | Supports `accounts`, `recent`, `draft`, and `send`, using JSON responses. |
| Custom/API/local-model writing | `writingHelper` | `OUTREACH_WRITING_HELPER` | Accepts a bounded JSON request file and returns normalized message JSON. ChatGPT/Codex, Claude, Cursor, and OpenCode Go plan CLIs use the bundled bridge instead. |
| Legacy workspace | `legacyWorkspace` | `OUTREACH_LEGACY_WORKSPACE` | Compatibility option for an existing private workflow containing the two enrichment helpers. |

Python helpers use the configured `python` command, which defaults to `python`.
Node.js helpers use the current Node runtime, and standalone executables run
directly. Paths are local-only and ignored by Git. `OUTREACH_OUTLOOK_HELPER`
remains a backward-compatible alias for `OUTREACH_MAILBOX_HELPER`.
The legacy workspace compatibility path retains its older Apollo-specific
arguments. Newly configured helpers receive only the provider-neutral arguments
listed above.

## Provider Notes

- **Apollo/Skrapp:** set the provider key only in the helper's process
  environment. The console never accepts it from the GUI or MCP arguments.
- **Microsoft Outlook or Gmail:** authorize through the mailbox helper's approved
  OAuth flow and map sender aliases to profiles in `local-config.json`.
- **IMAP/SMTP and custom mail:** use provider-approved OAuth where available and
  app passwords only when the provider requires them.
- **Hunter, Prospeo, Snov.io, and custom services:** run the action externally
  through an already-authorized connector/MCP, or implement the same local
  normalized helper contract.
- **Writing models:** use the outside-LLM handoff, select a bundled plan CLI, or
  implement `public/WRITING_ADAPTER_CONTRACT.md` for a custom/API/local-model path.

## Verification Order

1. Start the backend with `npm run dev:backend`.
2. Open Setup and select the provider roles.
3. Run **Test connections**. A provider is ready only when the backend reports a
   configured adapter and its no-cost check succeeds.
4. Run a shadow batch before allowing paid enrichment, drafts, or sends.

Public sample mode overrides every helper and remains a hard provider/send lock.
