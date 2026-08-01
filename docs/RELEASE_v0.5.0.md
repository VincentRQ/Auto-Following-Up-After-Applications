# Outreach Console v0.5.0

Version 0.5.0 makes the console much easier to pick up again after a day or a week away. Today is now the default screen, the current batch has a visible process rail, and every next-step panel explains what a click will do, what can run automatically, and what still needs a person.

## Daily Workflow

- Today collects new applications, contact gaps, drafts awaiting review, schedules,
  replies, redirects, interviews, and due follow-ups.
- A saved daily queue can be resumed in one click.
- The process rail tracks Applications, Contacts, Drafts, Review, Scheduled, Sent,
  and Responses.
- Blocked contact work now offers Find contacts, Enter contact, and Remove from
  batch. Jobs without contacts no longer create fake recipient slots.

## Clearer Setup

Simple view shows only Today, Applications, Messages, Activity, and Settings. The
existing three-panel console remains available as Advanced view.

The setup choice now controls the rest of the application. Templates only keeps
writing on templates or manual copy. Browser-only mode hides provider connections
that cannot run. No provider means manual work, and a provider is not marked ready
until its exact test passes.

## Easier Download and Updates

The Lite release is below 3 MiB and contains no runtime npm dependencies. The ZIP
has double-click launchers for Windows and macOS. Windows, macOS, and Linux can
download a portable Node 24 runtime after asking the user and checking Node.js's
published SHA-256 digest.

Settings can check for a new GitHub release and install it without replacing user
data. Update bundles are limited to managed application files, verified per file,
backed up, and rolled back after a partial failure. Managed update paths also
reject symbolic links and junctions so a local link cannot redirect a replacement
outside the application folder.

The setup wizard and daily workspace were checked at desktop and true 390 px
mobile widths. On narrow screens the process rail scrolls horizontally rather than
compressing its stages into overlapping labels.

## Upgrade Notes

Existing browser workspaces migrate in place. Workspace exports now use version 3
to include the daily queue and follow-up fields. Existing version 2 snapshots still
import. Automatic updates begin with this release, so earlier versions should use
the v0.5.0 ZIP once; later compatible releases can use the in-app updater.

Public Sample Mode remains locked from paid providers, AI calls, mailbox access,
and live sends.
