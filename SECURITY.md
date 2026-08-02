# Security

## Supported Release

Security fixes currently target the latest tagged release and the default
branch. Older portable releases should use the in-app updater or install the
latest release before reporting a reproducible issue.

## Boundaries

- Provider credentials remain outside MCP tool arguments and results.
- Sensitive tools are opt-in and external/state-changing actions are
  confirmation-gated.
- Public sample mode blocks provider helpers, AI/plan connection checks,
  generation, mailbox access, drafts, and sends.
- List outputs are capped and sensitive keys are redacted unless enabled.
- Imported content and mailbox text are treated as untrusted data.
- Browser access to the backend is restricted to configured loopback origins, and
  JSON request bodies are bounded.
- External database and writing adapters receive no credentials from GUI state;
  their credentials remain in their own process environments.
- Named compatible AI providers use backend-pinned HTTPS endpoints and
  environment-variable names. Browser values cannot redirect those credentials.
- Mailbox-provider responses are reduced to the IDs and links the UI needs before
  they cross the backend boundary.
- Lite updates accept only a version-matched release asset from approved GitHub
  hosts. Bundles are capped at 50 MiB, restricted to managed application paths,
  verified per file, backed up, and rolled back after a partial failure. The
  installer refuses symbolic links and junctions in managed update paths.
- The updater cannot replace `data/`, environment files, local databases, resumes,
  spreadsheets, provider credentials, or external storage.

These controls do not sandbox a client that also has unrestricted shell access.
Such a client may be able to call local provider helpers directly.

The loopback API is not an authentication boundary against other software already
running as the same operating-system user. Run the console only on a trusted local
account and do not expose its port through a proxy or network-forwarding rule.

## Automated Checks

- Pull requests and changes to `main` run the public repository's release
  verification and CodeQL workflows.
- Pull requests run GitHub's dependency review and fail when they introduce a
  known moderate-or-higher vulnerability in runtime, development, or unknown
  dependency scopes.
- CodeQL also runs weekly with the extended JavaScript and TypeScript security
  query suite.
- Dependabot checks npm packages and GitHub Actions weekly.
- Release verification runs both `npm audit --audit-level=high` and npm package
  signature verification.
- `npm audit --audit-level=high` checks published npm advisories.
- `npm run audit:release` rejects common credential formats, private document and
  database types, user-specific paths, and personal operational data.
- GitHub secret scanning should remain enabled on the public repository.

These checks do not call enrichment, mailbox, AI, or other paid application
providers. Automated results remain review inputs rather than proof that a
release is secure.

## Reporting

Report a suspected vulnerability through [GitHub's private vulnerability
reporting form](https://github.com/VincentRQ/Auto-Following-Up-After-Applications/security/advisories/new).
Use the GUI's **Share a bug** action only for sanitized, non-security defects. Use
**Email support** when a useful non-security reproduction requires private context
that should not be posted publicly. Do not include credentials, resumes, recruiter
contact exports, mailbox text, private database files, or user-specific local
paths in a public issue. Remove private data from a minimal reproduction before
sharing it.

The **Start fresh** action requires a short-lived one-time preview token and the
exact `START FRESH` phrase. It clears only Outreach Console browser state and,
when explicitly selected, records in the configured embedded SQLite database.
Source files, resumes, credentials, provider configuration, CLI logins, and
external databases are outside the deletion boundary.
