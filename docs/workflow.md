# Workflow

Outreach Console starts after an application is submitted:

```text
Apply -> Import -> Find contacts -> Write -> Review -> Send -> Monitor
```

The person using the console submits the application and supplies the listing. From there, the amount of automation depends on the selected storage, writing, contact, and email options.

## Start Each Day

Today opens by default. It shows new applications, missing contacts, drafts awaiting review, scheduled messages, replies requiring attention, redirects, interviews, and due follow-ups.

Use **Continue where I left off** for the current next action. A saved daily queue restores its available jobs, selects the correct profile, and returns to the last useful screen. Old or deleted rows are ignored.

The process rail stays visible when enabled:

```text
Applications -> Contacts -> Drafts -> Review -> Scheduled -> Sent -> Responses
```

Each stage has a count, status, and clickable next action. The guidance panel explains what the action will do, what is automatic, what still needs the user, and how to clear the current blocker.

## Work a Batch

1. Import CSV/XLSX or add an application by hand.
2. Confirm the profile, sender, resume, link, role, and position ID.
3. Select applications for one profile.
4. Resolve contact gaps. Use a tested provider, enter a contact, or remove the job from this batch.
5. Prepare one independent message for each known recipient. Jobs with no contacts do not receive placeholder recipients.
6. Review the name, address, listing fact, links, attachment, subject, wording, and word count.
7. Run a dry check now or schedule the connected workflow at the time shown on the button.
8. Reconcile accepted sends, replies, bounces, confirmations, rejections, redirects, and interview requests.

## What Runs Automatically

Browser-only mode validates imports, tracks stages, prepares templates, saves daily queues, and produces dry-run plans. Contacts, email, and responses are manual.

With the local service and tested providers, the console can discover contacts, call the selected writer, create provider drafts, schedule approved work, ingest mailbox events, and propose recovery steps. Provider selection alone does not enable any of these actions.

Sending and replying remain separate, explicit actions. Provider acceptance is recorded as pending reconciliation, not delivery proof.

## Recurring Follow-Up

An explicit `follow_up_due_at` date takes priority. Otherwise, the console calculates due work from the latest send, work, application, or import date using the saved follow-up interval. Rejected, bounced, skipped, and interview rows do not enter the ordinary follow-up queue.

Company history prevents two jobs at the same employer from producing contradictory outreach. Reply suppression, cooldowns, repeat-company rotation, OOO redirects, wrong-person referrals, bounce replacement, and repeated-failure warnings live in the local service when enabled.

## Writing Default

The default complete body stays under 80 words. It uses one factual listing responsibility, one supplied profile strength, a short application note, and one routing question. Every recipient has a separate editable draft.

Templates only forces template writing. An outside AI uses the handoff and operator guide. An in-app AI must pass its exact login or credential test before it can be treated as ready.

## Learn Without Risk

Open **How it works** for the 30-second path, the automatically advancing synthetic dry run, and expandable reference material. The synthetic run uses `.invalid` addresses and cannot spend provider credits or send email.
