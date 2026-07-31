# Outreach Console v0.3.0

This release adds account-backed AI writing without requiring a separately
billed model API, and tightens the public-data boundary around local application
and recruiter history.

## What this release solves

Outreach Console already separated application tracking, contact discovery,
writing, and sending. The missing piece was a clear way for someone who already
pays for an AI plan to use that plan from the local console without accidentally
falling through to an API key.

Version 0.3.0 adds bundled bridges for:

- ChatGPT through Codex CLI;
- Claude Pro, Max, Team, or Enterprise through Claude Code;
- a Cursor account through Cursor CLI;
- OpenCode Go through OpenCode CLI.

The original outside-AI, templates-only, local-model, and custom/API adapter
paths remain available.

## What "signed in through the CLI" means

The provider's command-line program must be installed for the same operating-
system account that starts the local backend. The user completes the provider's
browser or device login once. The CLI stores the resulting account credential in
its own local credential store, and Outreach Console invokes that CLI process.

The console does not ask for the account password and does not store a model API
key. **Test plan login** checks the CLI version and saved authentication only. It
does not submit a model prompt.

| Plan path | Sign in | Status check |
| --- | --- | --- |
| ChatGPT / Codex | `codex login` | `codex login status` must report ChatGPT |
| Claude plan | Run `claude` and complete Claude.ai login | `claude auth status --json` must report subscription auth |
| Cursor plan | `cursor-agent login` | `cursor-agent status` must report browser-account auth |
| OpenCode Go | Run `opencode`, then `/connect` and select OpenCode Go | `opencode auth list` plus `opencode models opencode-go` |

The setup screen includes installation commands, copy buttons, official
documentation links, status details, and provider-specific billing cautions.

## Plan-only controls

- API-key environment variables that could override ChatGPT, Claude, or Cursor
  account authentication are removed from the child process.
- OpenCode generation accepts only `opencode-go/*` models.
- Generation runs in a temporary workspace with tools denied or constrained,
  project instructions ignored, and structured output validated.
- Every result must contain exactly one unique message for every requested draft.
- A plan-backed request is rejected until the operator selects the strict
  plan-only guard.

The guard cannot change settings on a provider's website. Cursor users who do
not want overages must disable or cap on-demand usage in Cursor. OpenCode Go
users must turn off **Use balance** so Go does not fall back to a Zen balance.
Plan usage remains subject to each provider's allowance and limits.

## Public data boundary

The public repository includes two synthetic files:

- `data/sample-applications.csv`;
- `data/sample-recruiter-contacts.csv`.

They use a Customer Success demonstration profile, simulated companies and
people, and reserved `.invalid` email and web domains. A real recruiter workbook
is not tracked or packaged.

The GUI may restore a previously imported filename and rows from that browser's
IndexedDB/local storage. That local state does not travel with a Git clone,
JavaScript build, or release download. The Data Source view now labels the two
states explicitly as **Private local workspace** or **Synthetic public data**.

The public sample backend also forces a fresh in-memory database, so an existing
private SQLite or configured database path cannot leak CRM or mailbox history into
a demonstration session.

The release audit rejects workbooks, databases, non-allowlisted CSVs, personal
mailbox markers, local user paths, and private identity markers in release files
and every commit reachable from the release commit.

## Verification

The release suite covers:

- frontend unit and workbook tests;
- backend CRM, recovery, mailbox, routing, writing, and public-sample locks;
- fake-CLI authentication and generation for all four plan paths;
- temporary workspace cleanup and API-key override removal;
- MCP build and stdio smoke tests;
- production build, dependency audit, privacy audit, and visual browser QA.

No contact-enrichment, mailbox, email-send, or separately billed model API call
is required by the release test suite.

## Known boundaries

- Cursor CLI supports Windows through WSL, not a Windows-native backend. Run the
  backend in WSL or use Cursor as the outside AI operator.
- A successful login test proves the saved authentication path, not unlimited
  plan capacity or a remote billing setting.
- Claude, Cursor, and OpenCode generation still depends on the selected account
  being active when a real draft request is made.
- Public sample mode continues to block AI, enrichment, mailbox, and email
  provider actions regardless of other settings.
