import assert from "node:assert/strict";
import test from "node:test";
import { createConfirmStore } from "./confirm.js";

test("confirmation tokens are single-use and bound to exact normalized arguments", () => {
  const store = createConfirmStore();
  const token = store.issue("send", { subject: "Hello", contactId: 7 });
  assert.equal(store.consume("send", { contactId: 7, subject: "Hello" }, token), true);
  assert.equal(store.consume("send", { contactId: 7, subject: "Hello" }, token), false);
});

test("confirmation tokens reject changed arguments and expire", () => {
  let now = 1_000;
  const store = createConfirmStore(100, () => now);
  const changed = store.issue("send", { contactId: 7 });
  assert.equal(store.consume("send", { contactId: 8 }, changed), false);
  const expired = store.issue("send", { contactId: 7 });
  now += 101;
  assert.equal(store.consume("send", { contactId: 7 }, expired), false);
});
