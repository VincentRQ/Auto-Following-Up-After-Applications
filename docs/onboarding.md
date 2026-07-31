# Onboarding

## Public Sample Mode

Use this first. It prevents contact-provider calls, mailbox reads, drafts, and sends.

```powershell
$env:OUTREACH_PUBLIC_SAMPLE_MODE="1"
npm run dev:all
```

Load the sample rows in the GUI. Profiles, imports, preflight, reports, CRM,
dashboard, replay, and synthetic tests remain available.

## Private Operator Mode

1. Copy `data/local-config.example.json` to `data/local-config.json`.
2. Add one profile and its sender account alias.
3. Add the local resume path for that profile.
4. Use the first-run flow to select primary contact discovery, optional fallback,
   email service, and storage mode.
5. Choose browser-only, embedded SQLite, or an existing database adapter.
6. Put provider keys in the backend environment named in Setup.
7. Authorize each sender account through the selected mailbox adapter.
8. Start with `npm run dev:all` and open the Setup tab.

Every provider selection requires a compatible local adapter before it can run.
The source release includes provider-neutral enrichment, mailbox, and writing
bridges; it does not bundle vendor credentials, OAuth clients, or private helper
code. Apollo, Skrapp, Outlook, Gmail, Yahoo/IMAP, Hunter, Prospeo, Snov.io, and
custom services follow the same normalized contract. See
`docs/provider-adapters.md`. Selecting a provider never downloads code or stores a
secret in the browser.

## Application Data

Use a CSV with `company`, `job_title`, and `job_url` at minimum. Add
`job_description`, `profile`, `job_id`, `status`, and `applied_at` when
available. Choose **Link working file** for automatic sync to the original CSV.
Use **Import a copy** for XLSX or browsers without local file-handle support.

## AI Writer

Setup records which drafting engine you intend to use; selecting one does not
connect or invoke it. Codex CLI and Claude Code require their local CLI to be
installed and signed in. API providers require separate API credentials exposed
to the backend as environment variables. Do not paste API secrets into the GUI.

Until a private writing helper is connected, use **Outside AI**, **Templates**, or
**Manual** in the Writing view. Outside-AI mode copies a structured brief and
accepts the returned JSON without giving the outside model direct provider access.
In-app generation uses `OUTREACH_WRITING_HELPER` and the contract in
`public/WRITING_ADAPTER_CONTRACT.md`.

### Codex CLI With ChatGPT

1. Install the CLI with `npm install -g @openai/codex`.
2. Run `codex` under the same Windows account that starts this app.
3. Choose **Sign in with ChatGPT** and finish the browser login.
4. Verify the installation with `codex --version`.
5. Select **Codex CLI with ChatGPT** in Setup and enter the model, if the local
   adapter requires one.
6. Install a backend adapter that invokes `codex exec`, sends the drafting
   context through standard input, requires structured output, and rejects an
   invalid response before message copy is accepted.

The ChatGPT login belongs to the local Codex CLI. It is not an OpenAI API key,
and API billing is not used by this connection method.

### Claude Code With Pro or Max

1. Install the CLI with `npm install -g @anthropic-ai/claude-code`.
2. Run `claude` and complete the Pro, Max, or Console login.
3. Verify the local installation with `claude doctor`.
4. Select **Claude Code with Pro/Max** in Setup.
5. Install a backend adapter that invokes Claude in non-interactive print mode,
   passes the drafting context, and validates structured output before accepting
   message copy.

The Claude subscription login and Anthropic API are separate connection and
billing methods.

### Ollama

1. Install Ollama and ensure its local service is running.
2. Pull a model with `ollama pull <model-name>`.
3. Confirm the API is available at `http://127.0.0.1:11434/api`.
4. Select **Ollama local model**, enter the exact installed model name, and keep
   the default local base URL unless Ollama runs elsewhere.
5. Install a backend adapter for `/api/chat` or `/api/generate` and validate its
   output before accepting a draft. A local Ollama service does not require an
   API key.

### API Providers

API keys must be set in the PowerShell session that starts `npm run dev:all`, or
in a private user-level environment variable. Never add real keys to `.env`,
`data/local-config.json`, screenshots, logs, or exported run plans.

| Setup option | Environment variable | Base URL | Adapter |
| --- | --- | --- | --- |
| OpenAI API | `OPENAI_API_KEY` | `https://api.openai.com/v1` | OpenAI Responses API |
| Anthropic API | `ANTHROPIC_API_KEY` | `https://api.anthropic.com` | Anthropic Messages API |
| Google Gemini API | `GEMINI_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI-compatible |
| Groq API | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` | OpenAI-compatible |
| OpenRouter API | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | OpenAI-compatible |
| Other compatible API | operator-defined | provider-defined `/v1` URL | OpenAI-compatible with provider-specific checks |

Example for one PowerShell session:

```powershell
$env:OPENAI_API_KEY="<your key>"
npm run dev:all
```

For a persistent per-user variable, run
`[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "<your key>", "User")`,
then close and reopen the terminal before starting the app. Substitute the
provider's environment-variable name as needed.

In Setup, select the provider, enter its exact model ID, verify the base URL and
environment-variable name, and click **Test connections**. The connection is
ready only when that test reports the AI adapter as connected. A key being
present is not sufficient: the backend must also make a minimal authenticated
request and validate the returned schema.

OpenAI-compatible does not mean identical. The shared adapter must omit fields a
provider does not support and account for model-name, endpoint, token-limit, and
response-shape differences. Anthropic uses a distinct request format and should
not be routed through that shared adapter.

Private configuration, SQLite, provider work files, and local logs are ignored by
git. Do not put API keys in `local-config.json`; provider credentials stay in their
existing private credential stores.

## Storage

- **Browser only** is the smallest option and does not require the backend. It
  stores the workspace in the browser and disables CRM/mailbox automation.
- **Embedded SQLite** creates and migrates `data/outreach.sqlite` automatically.
- **Existing database** requires the downloadable PostgreSQL/MySQL schema and a
  private adapter implementing `public/DATABASE_ADAPTER_CONTRACT.md`.

External push/pull is manual by default. Pull downloads a local workspace backup
first. Automatic synchronization starts only after a successful push or pull in
the current session and stops on the first adapter error.

## Send Safety

Provider draft creation is available after profile routing passes. Sending remains disabled
unless the backend starts with `OUTREACH_LIVE_SEND=1`, and every request must
also contain the explicit `SEND_APPROVED` approval token.
