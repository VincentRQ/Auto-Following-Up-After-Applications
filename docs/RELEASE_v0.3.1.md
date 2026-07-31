# Outreach Console v0.3.1

This maintenance release adds a direct feedback path, a guarded way to return the
console to its first-run state without deleting connected files, and a compact
install-free package for ordinary operators.

## Trackable feedback

**Share a bug** opens a structured GitHub issue with version, operating system,
reproduction, expected behavior, and a privacy check. GitHub issues are the default
because they are searchable, notify repository maintainers, and preserve the
status of a fix. **Email support** remains available when useful context should not
be public.

New bug tickets are assigned to the repository owner so they do not depend only
on someone remembering to check the Issues page.

Neither path should contain credentials, resumes, recruiter exports, mailbox text,
private databases, or user-specific paths.

## Start fresh

The Setup panel now includes **Start fresh**. Before any state is removed, the GUI
downloads a JSON backup containing its browser workspace and non-secret settings.
When embedded SQLite is available, the operator can also clear local CRM, mailbox,
run, recovery, usage, and log history. The backend first creates a consistent copy
under the database's sibling `backups` directory.

The destructive step requires both a five-minute, single-use backend preview token
and the exact phrase `START FRESH`. The reset removes only Outreach Console browser
keys, its IndexedDB workspace, and the selected SQLite records. It preserves:

- application spreadsheets and other linked source files;
- resumes;
- `.env` files and provider configuration;
- API credentials and provider/CLI logins;
- external databases;
- local-storage keys belonging to other applications.

The console forgets its browser file handle, so reopening it exercises first-run
setup without overwriting the previously connected file.

## Interface wording

The former **Report** tab is now **Run Summary**. JSON and CSV exports are unchanged.

## Smaller operator release

The new Lite archive contains the prebuilt GUI, Node-standard-library backend,
standalone MCP bundle, schemas, and documentation without shipping `node_modules`
or asking the operator to run `npm install`. A release gate fails above 50 MiB,
while a packaged-app smoke test starts the extracted application and verifies both
the GUI and API. Development dependencies remain in source checkouts only.

Excel support is loaded only when an XLSX file is selected. CSV import, manual
entry, setup, and ordinary navigation no longer download or initialize the XLSX
parser during the first screen load.

## Operator usability

This candidate also finishes several lightweight operating controls: jobs can be
entered directly without a spreadsheet, an in-app guide walks through the working
areas, panel dividers support pointer and keyboard resizing, and additional themes
can be selected without modifying CSS. The calendar can export an operator-selected
set of events as a standard `.ics` file. Export is manual, and alerts remain off by
default.

## Verification

The release suite uses only synthetic fixtures and temporary databases. It checks
the token and phrase gates, SQLite backup creation, record removal, preservation of
neighboring source/config files, selective browser-state cleanup, the production
build, calendar preference and file generation behavior, MCP bundle, dependency
advisories, Lite package size, install-free startup, and release privacy rules. It
performs no paid enrichment, mailbox, email-send, or model-inference request.
