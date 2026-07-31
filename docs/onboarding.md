# Onboarding

## Public Sample Mode

Use this first. It prevents contact-provider calls, mailbox reads, AI connection
checks, drafts, and sends.

The Lite archive includes `Start Outreach Console - Sample Mode.cmd` for Windows
and `start-outreach-console-sample.sh` for macOS/Linux. These launchers set the
backend lock before the database opens. Loading synthetic rows in an ordinary
private session does not change the backend mode.

```powershell
$env:OUTREACH_PUBLIC_SAMPLE_MODE="1"
npm run dev:all
```

Load the sample rows in the GUI. Profiles, imports, preflight, reports, CRM,
dashboard, replay, and synthetic tests remain available.

The backend uses a fresh in-memory database in this mode, regardless of any
configured `OUTREACH_DATABASE` path. Private CRM and mailbox history are never
opened by the sample backend.

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

Setup records which drafting engine you intend to use. **Console invokes an AI**
can use the bundled Codex, Claude, Cursor, or OpenCode Go CLI bridge without a
separate writing helper. **Outside AI** leaves generation in an already running
agent, while **Templates only** does not invoke a model.

Selecting a CLI does not silently sign in or send a prompt. Follow the displayed
install and sign-in commands, then click **Test plan login**. That test checks the
CLI and saved authentication only; it does not consume an inference request. API
providers require separate credentials exposed to the backend as environment
variables. Do not paste API secrets into the GUI.

Here, **signed in through the CLI** has a precise meaning: the provider's local
command-line program is installed for the same operating-system account that runs
the backend, its browser or device authorization has saved a credential in that
CLI's own local store, and the console can verify that account-backed credential
with the provider's status command. The console does not receive the account
password and does not store a model API key.

Before plan-backed generation, select **Strict plan-only guard**. The backend
rejects the request without this confirmation. For providers with server-side
overage controls, first use the linked billing page: disable or cap Cursor
on-demand usage and turn off OpenCode Zen **Use balance**. The local app can block
API-key overrides and non-plan model namespaces, but it cannot change those remote
account switches itself.

### Codex CLI With ChatGPT

1. Install the CLI with `npm install -g @openai/codex`.
2. Run `codex login` under the same OS account that starts this app.
3. Finish **Sign in with ChatGPT** in the browser.
4. Select **ChatGPT plan / Codex CLI** and click **Test plan login**.
5. Leave the model blank to use the Codex default, or enter an available model.

The ChatGPT login belongs to the local Codex CLI. It is not an OpenAI API key,
and this connection does not supply one. Usage counts against that ChatGPT
account's Codex allowance or available ChatGPT credits.

### Claude Code With a Claude Plan

1. Install the CLI with `npm install -g @anthropic-ai/claude-code@latest`, or use
   Anthropic's native installer for your OS.
2. Run `claude` and complete the Claude.ai login for a Pro, Max, Team, or
   Enterprise account.
3. Select **Claude plan / Claude Code** and click **Test plan login**.
4. Leave the model blank to use the Claude Code default.

The bridge removes `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, Bedrock, Vertex,
and Foundry overrides before invoking Claude. Noninteractive use counts against
the subscription's Agent SDK allowance; it does not use Anthropic API billing.

### Cursor Plan

1. On macOS, Linux, or Windows WSL, install with
   `curl https://cursor.com/install -fsS | bash`.
2. Run `cursor-agent login` and finish the browser login.
3. Select **Cursor plan / Cursor CLI** and click **Test plan login**.

The bridge removes `CURSOR_API_KEY` and uses the saved browser account. Cursor's
status command confirms account authentication, not the paid tier; usage follows
the plan and credits attached to that account. Disable or cap on-demand usage from
the billing link next to the strict guard. On Windows, either start this app's
backend inside WSL or use Cursor as the outside operator.

### OpenCode Go

1. Install with `npm install -g opencode-ai`.
2. Run `opencode`, enter `/connect`, choose **OpenCode Go**, and paste the key
   issued by the Go subscription.
3. Select **OpenCode Go plan** and click **Test plan login**.
4. Leave the model blank to use the first available `opencode-go/*` model, or
   choose one from the model list loaded by the test.

OpenCode Go uses a plan-issued key rather than browser OAuth. The bridge accepts
only `opencode-go/*` model IDs and denies every model tool. A stored credential
check does not spend usage; the first actual generation proves the subscription
key is currently valid. Turn off **Use balance** in OpenCode Zen before confirming
the strict guard so requests stop when the Go allowance is exhausted.

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
| Google Gemini API | `GEMINI_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/openai` | Bundled compatible adapter |
| Groq API | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` | OpenAI-compatible |
| OpenRouter API | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | OpenAI-compatible |
| DeepSeek API | `DEEPSEEK_API_KEY` | `https://api.deepseek.com` | Bundled compatible adapter |
| Kimi API | `MOONSHOT_API_KEY` | `https://api.moonshot.ai/v1` | Bundled compatible adapter |
| Mistral API | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | Bundled compatible adapter |
| Together AI API | `TOGETHER_API_KEY` | `https://api.together.ai/v1` | Bundled compatible adapter |
| Cerebras Inference API | `CEREBRAS_API_KEY` | `https://api.cerebras.ai/v1` | Bundled compatible adapter |
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

In Setup, select the provider, enter its exact model ID, verify the displayed
base URL and environment-variable name, and click **Test connections**. The
built-in compatible adapters pin both values in the backend; browser settings
cannot redirect a key to another host or read a different environment variable.
The connection is ready only when the test reports the AI adapter as connected.
The test calls the provider's model-list endpoint and does not request generated
text.

OpenAI-compatible does not mean identical. The bundled paths cover only the
named providers in the table. An unlisted provider needs a reviewed writing
helper that handles its model names, request fields, limits, and response shape.
Anthropic uses a distinct request format and is not routed through this adapter.

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
