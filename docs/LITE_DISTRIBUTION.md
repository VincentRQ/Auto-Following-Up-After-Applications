# Outreach Console Lite

This is the prebuilt, install-free distribution of Outreach Console. It contains
the browser interface, local Node backend, standalone MCP server, public schemas,
and documentation. It does not contain the React/Vite/TypeScript development
toolchain or a `node_modules` folder.

## Start

1. Install Node 24 or newer.
2. Extract the `.tgz` archive. Current Windows, macOS, and Linux versions include
   `tar`; graphical archive tools can also open it.
3. From the extracted `package` folder:

   - Windows: double-click `Start Outreach Console.cmd`.
   - macOS or Linux: run `./start-outreach-console.sh`.

   To run a hard-locked demonstration instead, use
   `Start Outreach Console - Sample Mode.cmd` on Windows or
   `./start-outreach-console-sample.sh` on macOS/Linux. Then load the synthetic
   rows from Data Source. This mode cannot call provider helpers, plan CLIs, APIs,
   mailboxes, or live sends.

   The equivalent terminal command on any platform is:

   ```powershell
   node start.mjs
   ```

4. The launcher opens `http://127.0.0.1:43127` in the default browser.

No `npm install`, database server, container runtime, or vendor SDK is required.
Embedded SQLite is supplied by Node. Browser-only mode remains available when no
durable local history is wanted.

## MCP

The standalone MCP entry point is `mcp/outreach-mcp.js`. Start the GUI/backend
first, then configure an MCP client to run:

```text
node C:/absolute/path/to/package/mcp/outreach-mcp.js
```

The default backend address is `http://127.0.0.1:43127`. Provider actions,
contact details, mailbox content, and live sending remain off until explicitly
enabled. See the MCP and security documents under `docs/` before changing them.

## Optional services

Contact discovery, mailbox access, and AI writing are adapters, not bundled
vendor clients. Configure only the services you use. Their credentials remain in
local environment variables, their own CLI credential stores, or ignored local
configuration files.

The source repository is intentionally larger after `npm install` because it
contains compilers, tests, type definitions, and the local development server.
Those tools are not shipped in this Lite archive and are not loaded by ordinary
users.

## Size contract

Release packaging fails when this archive exceeds 50 MiB. The manifest records
every bundled file, its size, and SHA-256 digest. The release excludes source maps,
test fixtures, package caches, development logs, local databases, resumes,
spreadsheets, credentials, and provider work files.
