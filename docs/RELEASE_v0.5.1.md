# Outreach Console v0.5.1

Version 0.5.1 is a repository and release-pipeline security update. The outreach
workflow, saved data model, provider contracts, and interface remain compatible
with v0.5.0.

## GitHub Security Hardening

- Pull requests now run GitHub Dependency Review and reject newly introduced
  moderate-or-higher dependency vulnerabilities across runtime, development, and
  unknown scopes.
- Release verification now runs npm advisory and package-signature checks.
- GitHub Actions no longer retain checkout credentials after source retrieval.
- CodeQL is pinned to the current reviewed v4 commit.
- Dependabot groups safe minor and patch updates while leaving major upgrades for
  deliberate testing.
- The official repository enables private vulnerability reporting, immutable
  Action references, a GitHub-owned Action allowlist, and protected-branch
  checks.

## Security Audit Result

The pre-release GitHub audit found no open CodeQL alerts, Dependabot security
alerts, or secret-scanning alerts. These controls reduce the chance of a future
unsafe dependency, workflow, or direct branch change reaching a release.

Standard secret scanning and push protection are active. GitHub does not expose
non-provider pattern scanning or automatic validity checks for this personal
public repository tier, so those two enhanced checks remain unavailable.

Existing Lite installations can use **Check for updates** in Settings. The updater
preserves application data, resumes, linked files, credentials, and provider
configuration.
