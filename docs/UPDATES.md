# Updates

Automatic updates are available in the downloaded Lite release. Development checkouts and Public Sample Mode report that automatic installation is unavailable.

## What the Buttons Do

**Check for updates** reads the latest public GitHub release metadata. It does not download an application bundle or change local files.

**Install <version> and restart** downloads the matching `outreach-console-update-<version>.json` asset, verifies it, saves it under `data/updates`, and restarts the local service. The new process applies the update before reopening the interface.

## Verification

The updater accepts release metadata from the configured GitHub repository and update downloads from an allowlist of GitHub hosts. It requires an exact semantic version, exact asset name, HTTPS, a bundle under 50 MiB, unique managed paths, declared sizes, and a SHA-256 hash for every file. It also verifies GitHub's release-asset digest when that field is available.

The bundle cannot write outside the application folder. It cannot update `data/`, `.env`, local databases, spreadsheets, resumes, logs, or arbitrary files.

## Backups and Recovery

Files being replaced are copied to `data/update-backups/<timestamp>-<version>`. If one replacement fails, files already changed during that installation are restored. The pending update remains available for diagnosis or a later retry.

User state stays in place:

- `data/outreach.sqlite` and its backups
- provider work and local configuration
- browser storage
- resumes and linked application files
- environment variables and CLI login stores
- external databases

If the service does not return within the interface timeout, reopen the usual launcher. It will apply any verified pending bundle before starting.

## Manual Fallback

Open the latest GitHub release, download the new Lite ZIP, extract it to a new folder, and start it normally. Move only data you intentionally maintain inside the old `data` folder. Credentials, CLI logins, and source spreadsheets usually live outside the application folder and do not need to move.
