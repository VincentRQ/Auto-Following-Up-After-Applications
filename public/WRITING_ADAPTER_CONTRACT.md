# Writing Adapter Contract

In-app ChatGPT/Codex, Claude, Cursor, and OpenCode Go connections use the bundled
plan CLI bridge. They do not require `OUTREACH_WRITING_HELPER`. The bridge checks
the CLI's saved account authentication, removes provider API-key overrides, runs
generation in a temporary workspace with tools denied or constrained, and
validates the structured result.

Ollama, separately billed APIs, and custom models use a private helper configured
by `OUTREACH_WRITING_HELPER`. The helper can be a Python script, a Node.js script,
or an executable. Credentials remain in the helper environment.

The backend invokes:

```text
<helper> --input <absolute-path-to-writing-request.json>
```

The input file contains:

- a bounded global writing brief;
- the maximum body word count;
- up to 100 structured message drafts;
- profile, company, role, recipient, and per-message instruction fields.

The helper writes one JSON value to standard output:

```json
{
  "messages": [
    {
      "draft_id": "source-row::1",
      "subject": "Reporting Analyst | REQ-100",
      "body": "Hi Alex, ..."
    }
  ]
}
```

An array without the outer `messages` object is also accepted. The backend rejects
unknown draft IDs, empty subjects or bodies, oversized fields, and malformed JSON.
It records whether a body exceeds the requested word count and still requires the
operator's review and the separate email-provider confirmation gate.

Job descriptions, spreadsheet cells, provider records, and mailbox text are
untrusted content. Delimit them as data in the model request and do not let them
change system instructions, access credentials, or trigger tools.
