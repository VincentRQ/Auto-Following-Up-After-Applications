# The Application and Follow-Up Process

This project grew out of a practical problem: applying for a role is only one part
of a job search. Keeping profiles straight, recording each application, finding the
right internal contacts, writing a relevant note, spacing sends, tracking replies,
and handling bounces or referrals can take as much time as the application itself.

## 1. Keep each profile distinct

I start with separate job profiles, resumes, sender identities, and positioning.
A Data Analyst application should not silently use a Business Analyst resume or
mailbox. The console keeps profile selection explicit and blocks ambiguous rows.
Other users can add, rename, edit, or delete profiles for their own search.

## 2. Find and submit applications

I have used Hiring Cafe, Dice, SimplyHired, direct company career pages, and common
applicant-tracking systems such as Greenhouse, Workday, Ashby, Lever, iCIMS,
Workable, Eightfold, Oracle Recruiting, Paylocity, and BrassRing.

The application itself remains a human step. A person should review the role,
answer eligibility and salary questions honestly, attach the correct documents,
complete any CAPTCHA, and make the final submission. This project does not bypass
anti-bot controls or pretend to verify qualifications.

## 3. Record the application once

After applying, I record at least:

- company;
- job title;
- application link.

Profile, job description, position ID, source, status, and application date make
later outreach more accurate. The console imports CSV or XLSX files, recognizes
common header variations, and can keep a linked CSV synchronized.

## 4. Review and select a batch

The operator filters by profile and status, fixes missing fields, and selects the
applications to work. Preflight checks flag missing links, ambiguous profiles,
already-sent rows, and contact gaps before a batch is armed.

## 5. Find appropriate internal contacts

The contact provider is configurable. Apollo, Skrapp, Hunter, Prospeo, Snov.io, a
manual workflow, or another service can sit behind the same normalized adapter.
The targeting rules can prioritize recruiters and talent acquisition, then people
operations or adjacent HR roles. Company history prevents contradictory outreach,
supports contact rotation, and can pause the whole company after a human reply.

Provider records are leads, not truth. Names, titles, employment, and email quality
still need verification. Paid email or phone unlocks should occur only when the
operator has enabled them.

## 6. Write each message for its recipient

The Writing view can create multiple recipient slots for each selected job. A user
can:

- write the email manually;
- merge a template;
- copy a structured brief to an outside LLM and paste its JSON response back;
- use a private in-app LLM helper;
- set global instructions and override them for one person;
- edit and approve every subject and body independently.

The role link, position ID, resume, sender profile, and individual recipient remain
separate fields. AI output is always a draft. It should use supplied facts, avoid
inventing experience, and remain subject to human review.

## 7. Schedule and send carefully

The operator chooses the start time, spacing in seconds, and contact target. Email
providers are adapters too: Outlook, Gmail, IMAP/SMTP, or another service can be
used without changing the workflow model. Draft creation and live sending are
separate actions. Live sends retain explicit confirmation gates even when other
automation is enabled.

## 8. Reconcile what happened

After a send session, mailbox ingestion can classify application confirmations,
human replies, interview or next-step requests, rejections, out-of-office messages,
and hard bounces. The recovery center can prepare a referred-contact draft, rotate
to another contact, suppress further company outreach, or flag repeated failures.
The operator reviews the evidence before accepting an uncertain match.

## What this automates

In practice, the open-source GUI is intended to automate roughly 50% of the overall
workflow: organization, normalization, profile routing, batch review, contact and
mail adapter orchestration, individualized draft preparation, scheduling, history,
reply classification, and recovery bookkeeping.

It deliberately leaves the consequential half with the person: choosing suitable
roles, making truthful application decisions, completing protected forms, reviewing
contact quality, approving messages, responding to interviews, and maintaining the
relationship.

If your organization needs help with analytics, business intelligence, reporting,
KPI design, dashboard modernization, or data quality, please contact
[Vincent@Rosette.Solutions](mailto:Vincent@Rosette.Solutions) or visit
[Rosette Solutions](https://rosette.solutions/).
