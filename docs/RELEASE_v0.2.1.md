# Outreach Console v0.2.1

This patch release completes a production visual pass across the public
Outreach Console introduced in v0.2.0.

## What changed

- Setup diagnostics now stay within the right-side operational panel instead of
  clipping storage, AI ownership, and connection details.
- On phones, calendar headings, month controls, and the event legend remain
  visible while only the fixed seven-column month grid scrolls horizontally.
- The production build was rechecked at desktop, tablet, and mobile widths in
  terminal dark, light, and high-contrast themes.

## Safety and compatibility

No provider, credential, database, mailbox, or send behavior changed. Public
sample mode still blocks paid and email-provider actions, and all existing
v0.2.0 workspace and configuration formats remain compatible.

The full feature overview, operating models, safety design, installation guide,
and known boundaries remain documented in
[RELEASE_v0.2.0.md](RELEASE_v0.2.0.md).
