# Security Review: v0.5.1

## Result

The live GitHub security audit found zero open CodeQL alerts, zero Dependabot
security alerts, and zero secret-scanning alerts. Version 0.5.1 addresses
repository-level hardening gaps discovered during that audit; it does not claim
that automated checks prove the software is vulnerability-free.

## GitHub Controls Reviewed

- Code scanning and the extended JavaScript/TypeScript CodeQL query suite
- Dependabot vulnerability alerts, security updates, and version-update policy
- Secret scanning and push protection
- GitHub Actions token permissions, source pinning, and checkout credentials
- Pull-request dependency review and default-branch protection
- Private vulnerability reporting

## Changes

- Added a pinned GitHub Dependency Review workflow for every pull request.
- Added npm vulnerability and signature checks to release verification.
- Updated CodeQL to the current pinned v4 commit.
- Disabled persisted checkout credentials in every workflow.
- Limited routine npm version-update pull requests to minor and patch releases;
  Dependabot security updates remain unaffected.
- Added a private security-reporting route and documented the supported release
  boundary.
- Required full commit SHA references for Actions and limited workflow actions to
  GitHub-owned publishers in the official repository settings.

Standard secret scanning and push protection were already enabled. Attempts to
enable non-provider pattern scanning and automatic validity checks remained
disabled because GitHub does not make those enhanced options available to this
personal public repository tier.

## Verification

- `npm test`: 58 frontend tests passed and 66 backend/MCP tests passed. One
  workbook test remained skipped because its private operator fixture is
  intentionally excluded from the public repository.
- `npm run build`, `npm run build:mcp`, and `npm run smoke:mcp` passed.
- The Lite ZIP and TGZ started successfully through `npm run smoke:lite`.
- The source, GUI, MCP, Lite archives, and update bundle passed their size limits;
  the ZIP remained approximately 0.50 MiB with zero runtime npm dependencies.
- `npm audit --audit-level=high` reported zero vulnerabilities. All 193 installed
  packages had verified npm registry signatures, and 58 had verified
  attestations.
- The MCPB schema validated and the package identified itself as version 0.5.1.
  Packaging now refuses a future MCP/package version mismatch.
- The public release audit passed for 166 files, and all 34 backend, MCP, and
  release-script JavaScript files passed syntax checks.
- All repository YAML files parsed successfully and every workflow Action uses a
  full 40-character commit SHA.

## Residual Boundaries

- GitHub and npm checks detect known or modeled issues; they cannot establish that
  no unknown vulnerability exists.
- The updater still trusts the maintainer's GitHub account and official release
  assets as its publishing authority.
- A process running as the same operating-system user remains outside the
  loopback server's trust boundary.
- Custom adapters, external AI clients, browser extensions, and provider services
  retain their own security and privacy responsibilities.
