# Outreach Console Lite

Lite is the normal download for people who want to use Outreach Console rather than develop it. It contains the built interface, local service, MCP server, public schemas, operator skill, and help files. It has no `node_modules` folder and needs no `npm install`.

## Start on Windows

1. Download `outreach-console-lite-<version>.zip` from the latest GitHub release.
2. Extract the ZIP.
3. Open the extracted `outreach-console-lite-<version>` folder.
4. Double-click `Start Outreach Console.cmd`.

If Node 24 is missing, the launcher asks before downloading a portable Windows runtime from nodejs.org. It verifies the checksum published by Node.js and keeps the runtime under `.runtime/node` inside the application folder. It does not change the system Node installation.

## Start on macOS or Linux

On macOS, open `Start Outreach Console.command`. If macOS blocks the first launch, right-click it and choose **Open**. On Linux, run:

```sh
./start-outreach-console.sh
```

The launcher uses an existing Node 24 installation when available. Otherwise, it asks before downloading a portable runtime from nodejs.org and checks its SHA-256 digest. The `.tgz` release remains available for terminal users.

Every launcher opens `http://127.0.0.1:43127`. Nothing is hosted online, and no account is created.

Lite uses a portable ZIP rather than an unsigned installer. The first extraction
is manual, but the app's Settings update button handles compatible releases after
v0.5.0. A signed single-file desktop installer would exceed the project's current
size, signing, and maintenance boundaries.

## Try It Without Connections

Use the launcher with **Sample Mode** in its name, then load the synthetic rows from Application files. Public Sample Mode cannot call contact providers, plan CLIs, APIs, mailboxes, or live sends. It also ignores an existing private database.

The ordinary launcher can also use browser-only storage. In that mode, imports, manual contacts, templates, writing, daily queues, and dry checks work locally. Contact discovery, email handling, reply monitoring, and automatic recovery remain manual.

## First Run

The setup wizard asks how AI should operate, where to store work, which profiles to use, and whether any providers should be connected. Browser-only mode hides provider controls that cannot run. A provider does not become ready until its own test succeeds.

The main screen opens on Today. Use **Continue where I left off**, or open **How it works** for the short workflow and a synthetic guided run.

## Updates

Settings has **Check for updates**. A newer release can be downloaded, verified, installed, and restarted from the same screen. The updater backs up managed application files and preserves everything under `data/`, along with resumes, linked files, credentials, and external databases. Read `docs/UPDATES.md` for the exact boundary and manual fallback.

## MCP

Start the application first. Then point a compatible MCP client at:

```text
node C:/absolute/path/to/outreach-console-lite-<version>/mcp/outreach-mcp.js
```

The default backend is `http://127.0.0.1:43127`. Contact details, mailbox content, provider actions, and live sending remain separately disabled until you enable their documented gates.

## Package Size

The build fails if the Lite ZIP, `.tgz`, or update bundle exceeds 50 MiB. Version 0.5.0 is under 3 MiB before the optional portable Node runtime is downloaded. The package excludes source maps, test tooling, package caches, development logs, local databases, resumes, spreadsheets, credentials, and provider work files.
