<img src="assets/outreach-icon.png" alt="Outreach Console icon" width="72" height="72">

# Outreach Console

Outreach Console is a local, lightweight workspace for following up after job applications. It imports the jobs you already applied to, keeps each resume profile separate, helps prepare recipient-level emails, schedules reviewed batches, and tracks what happened afterward.

It does not apply to jobs, bypass CAPTCHAs, scrape LinkedIn, or send mail without the controls you choose. The useful part starts after an application has been submitted.

## What It Handles

- Import `.csv` and `.xlsx` application lists, or add a job by hand.
- Keep separate job profiles, sender accounts, resumes, instructions, and writing notes.
- Connect contact-discovery and email providers through replaceable adapters.
- Prepare one email per recipient with a job-specific detail and one simple ask.
- Start each day from a short Today queue with due work, replies, redirects, and interviews.
- Follow a visible Applications -> Contacts -> Drafts -> Review -> Scheduled -> Sent -> Responses rail.
- Run the full workflow in shadow mode before anything is sent.
- Space approved emails, keep company history, and avoid duplicate outreach.
- Track replies, application confirmations, rejections, bounces, and interviews.
- Handle OOO redirects, wrong-person referrals, bounced contacts, and repeated failures.
- Use the GUI directly or connect an AI through the bundled MCP server and operator skill.

The default Simple view has five destinations: Today, Applications, Messages, Activity, and Settings. Advanced view restores the full operational console. Both views use the same saved work.

## Quick Start

1. Open the [latest release](https://github.com/VincentRQ/Auto-Following-Up-After-Applications/releases/latest).
2. Download `outreach-console-lite-<version>.zip` and extract it.
3. Open the extracted `outreach-console-lite-<version>` folder.
4. On Windows, double-click `Start Outreach Console.cmd`.
5. On macOS, open `Start Outreach Console.command`. On Linux, run `./start-outreach-console.sh`.

The launcher starts the local service and opens `http://127.0.0.1:43127`. If Node 24 is missing, it asks before downloading a portable copy from nodejs.org, verifies the published SHA-256 checksum, and keeps it inside the application folder. No account is created, no `npm install` is needed, and the project sends no telemetry to its author.

The ZIP is intentionally portable instead of an unsigned installer. Extraction is
a one-time step; after v0.5.0, compatible releases can be installed from the
Settings update button without downloading or extracting another archive.

For a locked demonstration, use `Start Outreach Console - Sample Mode.cmd` on
Windows, `Start Outreach Console - Sample Mode.command` on macOS, or
`./start-outreach-console-sample.sh` on Linux, then load the
synthetic rows in Data Source. Public Sample Mode cannot call paid, AI, contact,
or email providers. Loading synthetic rows from the ordinary launcher does not
change the backend's operating mode; Setup always shows which mode is active.

## First Setup

The opening wizard asks for the parts that affect how the workflow runs:

1. Choose whether an outside AI operates the console, the console calls an AI, or no AI is used.
2. Pick browser storage, embedded SQLite, or an existing database adapter.
3. Edit or remove the starter job profiles. Their order is shuffled only on the first launch, then saved.
4. Choose contact and email providers when the selected storage mode can use them.
5. Test the selected connections before entering the main workspace.

Browser-only setup keeps provider work manual and hides connection controls that cannot run. Templates only selects template writing. A provider is never shown as ready merely because its name was selected.

The setup wizard can be reopened from the top bar. Start Fresh clears only Outreach Console state and offers a backup first. It does not remove resumes, spreadsheets, credentials, CLI logins, provider configuration, or external databases.

## Appearance

Settings -> Customize includes six full-workspace themes, five action accents,
two density levels, six optional background effects, adjustable panel widths,
and a reduced-motion control. The live specimen shows the selected colors on
the same status, count, and progress elements used throughout the console.

The **Amber Console** option is a dependency-free theme adapted for this
project and inspired by [DutchDiederik/AmberConsole](https://github.com/DutchDiederik/AmberConsole).
It does not download or bundle AmberConsole fonts, JavaScript, or stylesheets.

## Daily Use

Today opens by default and answers five questions without making you interpret system logs:

- Where am I in the process?
- What should I do next?
- What will happen when I click the next action?
- What is automated, and what still requires me?
- Why is something blocked, and how do I fix it?

Save a daily queue to keep due and overdue follow-ups together. **Continue where I left off** restores that queue, its profile, and the last useful screen. The process rail shows a count and next action for every stage. Blocked contact work links directly to **Find contacts**, **Enter contact**, and **Remove from batch**.

Open **How it works** for a 30-second overview, a synthetic guided dry run, and the detailed reference. The demonstration never calls a provider, spends a credit, invokes an AI, or sends email.

## Application File

The minimum columns are:

| Column | Purpose |
| --- | --- |
| `company` | Employer name |
| `job_title` | Role title |
| `job_url` | Original listing or application link |

These columns improve matching and writing:

| Column | Purpose |
| --- | --- |
| `job_description` | Supplies a factual opening detail |
| `profile` | Routes the correct sender and resume |
| `job_id` | Preserves the requisition or position ID |
| `status` | Records the current application stage |
| `applied_at` | Places the application on the calendar |

Common aliases such as `company_name`, `role`, `link`, `req_id`, and `date_applied` are recognized. A linked CSV can be written back after changes. Ordinary uploads remain local and can be exported when needed.

## AI Choices

AI is optional. The console supports several ownership models because users already have different tools and subscriptions.

| Choice | How it works |
| --- | --- |
| Outside AI | Codex, Claude, Cursor, or another agent uses the MCP server and its own connectors. |
| Existing plan CLI | The backend can use a signed-in Codex, Claude Code, Cursor, or OpenCode Go CLI. Separate API-key credentials are blocked in plan-only mode. |
| Local model | Ollama can be connected through the local writing-adapter contract. |
| Compatible API | Gemini, Groq, OpenRouter, DeepSeek, Kimi, Mistral, Together AI, and Cerebras have a built-in dependency-free bridge. |
| Other API | OpenAI, Anthropic, or another service can use a small writing adapter. |
| Templates only | No model or account is needed. |

API billing is separate from ChatGPT, Claude, Cursor, and OpenCode subscriptions. API keys stay in environment variables read by the local backend. They are not stored in the browser workspace or accepted as MCP tool arguments.

Provider names and model IDs change. The setup screen links to each provider's current documentation instead of locking the app to a stale model list.

## Default Email Shape

The default body is capped at 80 words, including the greeting and sign-off. It uses four short sentences:

1. A factual responsibility from the job listing.
2. One supplied point of fit from the selected profile.
3. A simple note that the application was submitted.
4. One routing question.

The prompt forbids invented praise, invented company problems, unsupported experience, urgency, and multiple calls to action. Every recipient still has a separate editable draft. See [Writing Guide](docs/WRITING_GUIDE.md) for the research and the job-search adjustments behind the default.

## The Workflow This Came From

This project grew out of a manual process: find a role, apply on the employer's site, log the application, identify a few relevant internal recruiting contacts, write a short follow-up, space the sends, then watch for replies and redirects.

The source roles have come from places such as HiringCafe, Dice, and direct employer listings. Applications often finish in Greenhouse, Workday, Ashby, Lever, Workable, iCIMS, Eightfold, Oracle Cloud, Paylocity, and similar systems. Those sites change, and some use anti-automation controls, so the application step remains with the user.

Outreach Console focuses on the repetitive half after that point. It organizes the file, prepares the contact and writing work, preserves the correct profile and attachment, schedules reviewed sends, and records the results. The final judgment stays with the person running it.

## Storage

- Browser mode stores jobs, drafts, preferences, and reports in that browser. It needs no backend database.
- Embedded SQLite adds company history, contacts, mailbox events, provider usage, recovery cases, and replayable runs. SQLite is included with Node 24.
- External mode uses a private adapter for PostgreSQL, MySQL, or another database. The app does not take a raw database password.

Jobs sit under companies, and outreach sits under contacts. This prevents two applications at the same company from creating contradictory follow-up.

## Updates

The downloaded Lite release checks GitHub only when you press **Check for updates** in Settings. If a newer release is available, **Install version and restart** names the exact action before it runs.

The updater accepts only the matching release bundle from approved GitHub hosts. It verifies the release digest when GitHub supplies one, verifies every file hash, stages the update under `data/updates`, backs up replaced application files, and rolls back a partial installation. It never replaces `data/`, resumes, linked spreadsheets, environment files, provider credentials, or external databases. Source checkouts and Public Sample Mode do not install updates automatically. See [Updates](docs/UPDATES.md).

## MCP And Skill

The Lite package includes `mcp/outreach-mcp.js` and `skills/outreach-console-operator/`.

Start the GUI/backend first, then point an MCP client at:

```text
node C:/absolute/path/to/package/mcp/outreach-mcp.js
```

Read [AI Operator Guide](public/AI_OPERATOR_GUIDE.md) before enabling contact details, mailbox content, provider actions, or live sends. State-changing tools use short-lived confirmation tokens tied to the exact arguments.

## Safety

- The backend binds to loopback only by default.
- Public sample mode locks external providers.
- Drafting and sending are separate actions.
- Live sending needs both backend and MCP gates plus exact confirmation.
- Imported descriptions and mailbox text are treated as untrusted data.
- Release checks reject common credentials, personal paths, private documents, databases, and contact exports.
- The Lite archive has a hard 50 MiB ceiling and no runtime npm dependencies.

Read [Security](SECURITY.md), [Privacy](PRIVACY.md), and the
[latest security review](docs/SECURITY_REVIEW_v0.5.1.md) before connecting a real mailbox
or provider.

## Development

```powershell
npm ci
npm run dev:all
```

The development GUI opens at `http://127.0.0.1:5177`; the local backend uses `http://127.0.0.1:43127`.

Before a release:

```powershell
npm test
npm run build
npm run build:mcp
npm run pack:lite
npm run smoke:lite
npm run pack:mcp
npm audit --audit-level=high
npm run audit:release
```

Technical context for coding agents is in [LLM Operator Guide](docs/LLM_OPERATOR_GUIDE.md). Adapter contracts and extension points are listed in [Extending](docs/EXTENDING.md).

## License

Copyright (c) 2026 Vincent Quimby. Released under the [MIT License](LICENSE).

MIT requires copies or substantial portions of the software to retain the copyright and license notice. If you build something from this project, a link back is appreciated, but it is not an extra license requirement.

For analytics, business intelligence, reporting architecture, or related data work, contact [Vincent@Rosette.Solutions](mailto:Vincent@Rosette.Solutions) or visit [Rosette Solutions](https://rosette.solutions).
