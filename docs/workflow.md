# Workflow

1. Import an application file or add a job by hand.
2. Confirm the profile, sender, resume, job URL, and position ID.
3. Select jobs for a batch.
4. Check company history, suppression, cooldown, and prior contacts.
5. Discover or enter recipient-level contacts.
6. Prepare a separate draft for each recipient.
7. Review job-specific detail, claims, links, attachment, subject, and word count.
8. Build a shadow batch and inspect the queue.
9. Schedule and approve a live batch only when it is ready.
10. Reconcile sent mail, replies, bounces, confirmations, rejections, redirects,
    and interview requests.

## Operational Controls

- Shadow mode builds the complete queue and report without sending.
- Backend submit sends only ready rows to the configured loopback service.
- Draft creation and live sending remain separate actions.
- The Run Summary exports JSON or CSV after a run.
- Workspace export and import preserve the browser operator state as JSON.
- Queue review shows ready, blocked, and already-sent work before launch.
- The job editor fixes an imported row without forcing a source-file edit first.
- Linked CSV mode can write approved changes back to the connected source.
- Calendar export creates a user-selected `.ics` file and never writes silently to
  an external calendar.

## Writing Default

The default complete body stays under 80 words and uses one factual listing detail,
one supplied profile strength, a note that the application was sent, and one
routing question. Every message remains editable and separately reviewable.

## Adapter Boundary

The GUI never stores mailbox credentials or provider API keys. Plan CLIs use their
own credential stores. Named compatible APIs read keys from backend environment
variables. Contact, mailbox, local-model, and custom services use small private
adapters with bounded structured input and output.

The backend owns account routing, contact ranking, company history, duplicate
prevention, mailbox classification, recovery, and send gates. The GUI and MCP are
control surfaces over those rules.
