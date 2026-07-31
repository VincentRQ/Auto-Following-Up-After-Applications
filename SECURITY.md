# Security

## Supported Release

Security fixes currently target the latest tagged release and the default
branch.

## Boundaries

- Provider credentials remain outside MCP tool arguments and results.
- Sensitive tools are opt-in and external/state-changing actions are
  confirmation-gated.
- Public sample mode blocks provider calls and sends.
- List outputs are capped and sensitive keys are redacted unless enabled.
- Imported content and mailbox text are treated as untrusted data.
- Browser access to the backend is restricted to configured loopback origins, and
  JSON request bodies are bounded.
- External database and writing adapters receive no credentials from GUI state;
  their credentials remain in their own process environments.

These controls do not sandbox a client that also has unrestricted shell access.
Such a client may be able to call local provider helpers directly.

## Automated Checks

- Pull requests and changes to `main` run the public repository's release
  verification and CodeQL workflows.
- CodeQL also runs weekly with the extended JavaScript and TypeScript security
  query suite.
- Dependabot checks npm packages and GitHub Actions weekly.
- `npm audit --audit-level=high` checks published npm advisories.
- `npm run audit:release` rejects common credential formats, private document and
  database types, user-specific paths, and personal operational data.
- GitHub secret scanning should remain enabled on the public repository.

These checks do not call enrichment, mailbox, AI, or other paid application
providers. Automated results remain review inputs rather than proof that a
release is secure.

## Reporting

Do not open a public issue containing credentials, resumes, recruiter contact
exports, mailbox text, private database files, or local paths. Remove private
data from a minimal reproduction before reporting a problem.
