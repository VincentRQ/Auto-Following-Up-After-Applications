const CONTACT_KEYS = new Set(["email", "contact_email", "recipient"]);
const MAILBOX_KEYS = new Set(["sender_email", "sender_name", "preview", "body"]);

export function redact(value, { exposeContacts = false, exposeMailbox = false } = {}) {
  if (Array.isArray(value)) return value.map((item) => redact(item, { exposeContacts, exposeMailbox }));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!exposeContacts && (key === "contacts" || key === "contact_name" || CONTACT_KEYS.has(key))) continue;
    if (!exposeMailbox && (key === "unmatchedMailbox" || key === "events" || key === "preview" || key === "sender_email" || key === "sender_name")) continue;
    if (!exposeMailbox && MAILBOX_KEYS.has(key)) continue;
    output[key] = redact(item, { exposeContacts, exposeMailbox });
  }
  return output;
}
