# Security Review: v0.4.0

## Scope

This review covered the v0.4.0 working tree, built GUI, standalone MCP bundle,
Lite archive, loopback backend, SQLite reset path, provider helpers, plan CLI
bridge, named compatible API bridge, browser storage, and public release files.

The review used local source inspection, negative-path tests, fake providers,
synthetic data, package validation, `npm audit`, secret scanning, archive
inspection, and runtime smoke tests. It did not invoke the paid Codex Security
CLI. Estimated scan spend was USD 0.

## Findings Fixed

1. Named API requests accepted a browser-supplied environment-variable name.
   Each built-in provider now uses a fixed backend endpoint and fixed key name.
2. Public Sample Mode could run connection checks and read private local provider
   configuration. It now skips private config, helper paths, account routing,
   provider checks, plan CLIs, APIs, mailboxes, drafts, and sends.
3. MCP redaction missed alternate recipient fields and duplicate raw JSON values.
   Service responses now omit raw JSON copies, and MCP redaction covers those
   address forms and email-shaped values.
4. A mailbox helper's complete send response could reach the browser. The API now
   returns only the provider message ID needed for reconciliation.
5. Direct backend calls did not reject line breaks in email subjects. Contact,
   subject, body, null-byte, and size checks now run at the service boundary.
6. Corrupt profile or AI settings could survive shallow storage validation and
   break Setup. Local storage and imported configuration now use the same bounded
   normalizers.
7. A Lite build started on a custom port could prefill the standard backend port,
   allowing its GUI to address another local instance. Production builds now use
   their own loopback origin, and Sample Mode's content policy permits only that
   locked same-origin backend.

Static-file traversal was already blocked by canonical path checks. Coverage now
includes encoded traversal and symbolic-link escape regression tests.

## Verification

- Frontend, backend, and MCP test suites use fake services and synthetic data.
- Public Sample Mode is tested against a configured private database and private
  helper paths.
- MCP confirmation tokens are single-use, expire, and bind to exact arguments.
- Plan CLI tests verify API-key removal, denied tools, temporary workspaces, and
  strict plan-only confirmation.
- Named API tests verify endpoint/key pinning, no-generation credential checks,
  response limits, malformed output rejection, and error redaction.
- The Lite archive runs from a fresh temporary extraction with no `node_modules`
  or runtime npm dependencies.
- Release scanning rejects common credentials, private documents, databases,
  personal paths, and non-synthetic contact exports.

## Limits

No real enrichment provider, mailbox, model, external database adapter, or live
send was exercised. Those systems require the operator's own credentials and can
change independently. User-supplied helper code remains trusted local code and
must be reviewed before installation. Browser extensions, operating-system
security, provider account policy, and email deliverability are outside this
repository review.

One private-workbook import test is skipped when that private fixture is absent;
the public CSV/XLSX parsing and synthetic end-to-end paths remain covered.

This is a bounded source and runtime review, not a guarantee that the system is
free of vulnerabilities.
