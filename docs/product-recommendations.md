# Product Recommendations Implemented

## 1. Portable Workspaces

Users need to move between machines or share a clean starter state. The app now
supports workspace export/import as JSON, including profiles, jobs,
instructions, backend URL, and recent reports.

## 2. Rich Profile Configuration

Different users have different job profiles. Profiles now support add/delete,
selection, sender name, sender email, resume label, and notes. Profile values
from imported workbooks can also become stable custom profile keys.

## 3. Editable Job Rows

Imported spreadsheets will not always be clean. Selecting a job opens an editor
for company, role, job ID, URL, profile, status, contact count, and notes.

## 4. Queue Review Before Launch

Users should see what will happen before a send. The app now builds a preflight
queue with ready, blocked, and already-sent states, blockers, contact quality,
ETA, and a ready-only selection action.

## 5. Backend Diagnostics

The GUI should remain lightweight, but operational sending needs a private
backend. The app now has backend URL storage, backend health checks, provider
status display, dry-run/backend modes, and run-plan export.
