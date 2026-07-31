const CONTACT_KEYS = new Set(["email", "contact_email", "contactemail", "recipient", "recipient_email", "recipientemail", "recipient_name", "recipientname", "redirect_email", "failed_email", "to"]);
const MAILBOX_KEYS = new Set(["sender_email", "sender_name", "from_email", "from_name", "preview", "body"]);
const INTERNAL_JSON_KEYS = new Set(["context_json", "evidence_json", "metadata_json", "payload_json", "plan_json", "proposed_action_json", "request_json"]);
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export function redact(value, { exposeContacts = false, exposeMailbox = false } = {}) {
  if (Array.isArray(value)) return value.map((item) => redact(item, { exposeContacts, exposeMailbox }));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (INTERNAL_JSON_KEYS.has(normalized)) continue;
    if (!exposeContacts && (normalized === "contacts" || normalized === "contact_name" || CONTACT_KEYS.has(normalized))) continue;
    if (!exposeMailbox && (normalized === "unmatchedmailbox" || normalized === "events" || MAILBOX_KEYS.has(normalized))) continue;
    if (!exposeContacts && !exposeMailbox && typeof item === "string" && EMAIL_PATTERN.test(item)) continue;
    output[key] = redact(item, { exposeContacts, exposeMailbox });
  }
  return output;
}
