import assert from "node:assert/strict";
import test from "node:test";
import { loadMcpConfig, normalizeLoopbackBackendUrl } from "./config.js";
import { redact } from "./privacy.js";

test("sensitive MCP capabilities are disabled by default", () => {
  const config = loadMcpConfig({});
  assert.equal(config.exposeContacts, false);
  assert.equal(config.exposeMailbox, false);
  assert.equal(config.enableProviderActions, false);
  assert.equal(config.enableLiveSend, false);
});

test("privacy redaction separates contact and mailbox opt-ins", () => {
  const value = { contacts: [{ email: "recruiter@example.test" }], sender_email: "sender@example.test", preview: "message", totals: { jobs: 2 } };
  assert.deepEqual(redact(value, {}), { totals: { jobs: 2 } });
  assert.deepEqual(redact(value, { exposeContacts: true }), { contacts: [{ email: "recruiter@example.test" }], totals: { jobs: 2 } });
  assert.deepEqual(redact(value, { exposeMailbox: true }), { sender_email: "sender@example.test", preview: "message", totals: { jobs: 2 } });
});

test("MCP backend URLs are restricted to loopback services", () => {
  assert.equal(normalizeLoopbackBackendUrl("http://127.0.0.1:43127/"), "http://127.0.0.1:43127");
  assert.equal(normalizeLoopbackBackendUrl("https://localhost:43127"), "https://localhost:43127");
  assert.throws(() => normalizeLoopbackBackendUrl("https://remote.example"), /loopback/i);
  assert.throws(() => normalizeLoopbackBackendUrl("http://user:secret@127.0.0.1:43127"), /credentials/i);
  assert.throws(() => normalizeLoopbackBackendUrl("http://127.0.0.1:43127/proxy"), /path/i);
});
