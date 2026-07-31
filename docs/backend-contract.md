# Backend Contract

The GUI is intentionally credential-free. A private local backend owns email,
enrichment, writing, and provider-specific logic when those capabilities are
enabled. Browser-only mode does not require this service.

## Submit Batch

`POST /api/batches`

Request body:

```json
{
  "profile": "data_analyst",
  "scheduled_at": "2026-07-10T15:00",
  "spacing_seconds": 30,
  "contact_target": 3,
  "instructions": {
    "emailTemplate": "Short recruiter follow-up...",
    "targetInstructions": "Prioritize talent/recruiting contacts...",
    "aiInstructions": "Write from the candidate POV..."
  },
  "queue": [
    {
      "source_row_id": "row-1",
      "company": "Example Analytics",
      "role_title": "Data Analyst",
      "job_id": "REQ-100",
      "job_url": "https://example.com/jobs/REQ-100",
      "profile": "data_analyst",
      "contact_quality": "clean"
    }
  ]
}
```

Implemented behavior:

- Run final validation server-side.
- Create deterministic shadow contacts if needed.
- Build inert draft plans without sending.
- Respect spacing and profile/account routing.
- Return non-2xx with a readable message when blocked.
- Write durable run logs when backend storage is enabled.

The response includes a `run_id`. Retrieve it with `GET /api/runs/:runId` or
replay it with `POST /api/runs/:runId/replay`.

## Health

`GET /api/health`

Suggested response:

```json
{
  "status": "ok",
  "providers": {
    "mailbox": "configured",
    "enrichment": "configured"
  }
}
```

## Company CRM

`GET /api/crm/companies`

Returns normalized companies with their jobs, contacts, suppression state, and
last-contact history. Variations such as `Acme, Inc.` and `ACME INC` resolve to
the same company.

`GET /api/crm/companies/:companyId` returns the full company record, including
jobs, contacts, historical outreach, exceptions, and the append-only timeline.

`POST /api/crm/companies/:companyId/contacts` creates or updates a contact.

`POST /api/crm/companies/:companyId/outreach` records a historical or current
outreach state such as `drafted`, `sent`, `replied`, `bounced`, or `rejected`.
Sent, delivered, and replied states update the contact rotation date.

`POST /api/crm/companies/:companyId/suppression` pauses or resumes company-level
outreach. Suppression is checked before every shadow plan.

## Recovery Center

`GET /api/exceptions` lists recovery cases.

`POST /api/exceptions` records an observed outcome. Supported initial types are
`ooo_redirect`, `hard_bounce`, `invalid_email`, `positive_reply`,
`wrong_person`, `next_steps`, and `provider_limit`.

Recovery rules propose redirected drafts, replacement contacts, provider pauses,
or company-level outreach suppression. Four consecutive address failures raise a
warning.

`POST /api/exceptions/:exceptionId/resolve` completes, dismisses, or defers a
case. Completing a referral or OOO redirect retains the referred contact in the
company record.

## Provider Integration

`GET /api/providers/check` verifies the selected contact and mailbox helpers,
profile routing, and account authorization without spending enrichment credits.

`POST /api/crm/companies/:companyId/enrich` invokes the selected normalized
contact helper. Paid email or phone unlocks run only when `spend_credits` is true.

`POST /api/outreach/drafts` creates a provider draft through the profile's
configured account and records it in company history.

`POST /api/outreach/send` requires both `OUTREACH_LIVE_SEND=1` at backend start
and an `approval` value of `SEND_APPROVED`. This prevents retries or browser
actions from turning into accidental sends.

## Individualized Writing

`GET /api/writing/drafts?profile=:profile` returns up to 1,000 saved message drafts.

`POST /api/writing/drafts` validates and upserts one manual, template, or generated
message. It does not create a provider draft or send email.

`POST /api/writing/generate` passes up to 100 structured drafts to the configured
writing helper. The backend accepts only requested draft IDs, bounded subject/body
fields, and valid JSON. Generated copy is stored with `ready` status for operator
review. Public sample mode blocks this provider call.

## Mailbox Ingestion

`POST /api/mailbox/sync` reads recent mail from configured profile accounts,
classifies application confirmations, rejections, replies, OOO messages, and
bounces, and updates only high-confidence company/job matches.

`GET /api/mailbox/events?state=attention` returns unmatched messages plus
matched, unreviewed human replies and next-step responses. The GUI polls this
view every five minutes while a mailbox helper is configured. `state=unmatched` remains
available when only ambiguous messages are needed.
`POST /api/mailbox/events/:eventId/review` attaches or dismisses one event.

Messages that request an interview, phone screen, scheduling, availability,
assessment, or another explicit next step are classified as `interview`. They
are shown with **Next step: your attention is required**, update the matched job
to `interview`, create a `next_steps` Recovery Center case, and suppress further
company outreach until reviewed. Rejections are evaluated first so ordinary
rejection language is not misclassified as progress.

Matched bounces, OOO messages, human replies, and next-step responses create
deduplicated Recovery Center cases. Raw messages remain in the email provider;
backend storage keeps only the operational fields required for reconciliation.

## HTTP Boundary

The service binds to loopback. Browser origins default to
`http://127.0.0.1:5177` and `http://localhost:5177`; override them with
`OUTREACH_ALLOWED_ORIGINS`. JSON bodies default to a 2 MiB maximum configured by
`OUTREACH_MAX_BODY_BYTES`. Requests without a browser `Origin` header remain
available to the local MCP and scripts.
