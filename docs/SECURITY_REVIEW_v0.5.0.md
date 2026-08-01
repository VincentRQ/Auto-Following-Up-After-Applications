# Security Review: v0.5.0

## Result

No confirmed high- or medium-priority finding remains in the reviewed v0.5.0
source and Lite package. One local-path hardening issue was found during the
review: a pre-existing symbolic link or Windows junction inside a managed update
path could have redirected a file replacement. The updater now rejects links in
those paths, and a regression test confirms that no file is written through the
link.

GitHub CodeQL also identified two URL-substring checks in updater mocks and two
intentional network-to-file writes in the updater. The mocks now parse and compare
the exact host. The staging writes are retained because downloading an update is
their purpose; they are limited to the approved GitHub hosts, 50 MiB response cap,
semantic version and asset name, managed-path allowlist, per-file hashes, optional
GitHub digest, fixed staging directory, and symlink/junction checks.

This was a zero-spend review. The current official
`@openai/codex-security` version was resolved as `0.1.5`, but its model-backed scan
was not run because the operator required that this pass incur no usage charge.
No Codex Security result or state directory was created. The unexecuted standard
working-tree scan would use a private directory outside the repository and a
bounded `--max-cost` value.

## Scope

- React interface, browser storage, import/export, daily queue, and setup flow
- loopback HTTP server, static-file boundary, SQLite service, and reset path
- provider helpers, compatible AI bridge, plan-backed CLI invocation, and MCP
- mailbox handling, send gates, confirmation tokens, and public sample lock
- Lite launchers, portable Node bootstrap, package scripts, and in-app updater

Third-party provider services, account configuration, external adapters, browser
extensions, mail-delivery reputation, and the security of GitHub itself were not
tested.

## Verification

- `npm test`: 58 frontend tests passed; 66 backend/MCP tests passed. The one
  skipped public test requires a private operator workbook that is intentionally
  absent from the repository.
- `npm run build`: TypeScript and the production Vite build passed.
- `npm run smoke:lite`: both extracted Lite formats started successfully; health,
  setup, sample locks, updater status, static assets, and missing-file behavior
  passed.
- `npm run audit:size`: source, GUI, MCP, ZIP, TGZ, and update bundle passed their
  limits. The ZIP is below 0.5 MiB and has no runtime npm dependencies.
- `npm audit --audit-level=high`: zero known vulnerabilities.
- `npm audit signatures`: 193 package signatures and 58 attestations verified.
- `npm run audit:release`: 162 public files passed path, document-type, identity,
  mailbox-domain, credential-pattern, sample-data, and Git-history checks.
- Every backend, MCP, and release-script JavaScript file passed `node --check`.
- The Windows portable bootstrap downloaded Node `v24.18.1` from nodejs.org,
  verified its published SHA-256 checksum, and launched the packaged app.
- Desktop and true 390 px mobile screenshots were inspected. Setup, Simple view,
  Advanced view, Templates only, browser-only behavior, blocker actions, the
  synthetic walkthrough, saved queue, and updater messaging were exercised.

## Residual Boundaries

- The updater trusts the maintainer's GitHub repository and GitHub-hosted release
  assets. Per-file hashes detect corruption but are not an independent signing
  authority if that publishing account is compromised.
- The backend binds to loopback and rejects foreign browser origins, but it does
  not authenticate against another process already running as the same local
  operating-system user.
- Plan CLIs, outside AIs, browser extensions, and custom adapters have their own
  permissions. This project cannot sandbox a separately installed tool that has
  broader filesystem, shell, mailbox, or provider access.
- A successful provider response is not proof of inbox delivery, recruiter fit,
  or application outcome. Review and reconciliation remain part of the workflow.

This is a bounded source and runtime review, not a guarantee that the system is
free of vulnerabilities.
