import { createHash, randomUUID } from "node:crypto";

function canonical(value) {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)))
      : item,
  );
}

export function createConfirmStore(ttlMs = 120_000, clock = Date.now) {
  const entries = new Map();
  const keyFor = (action, args) => createHash("sha256").update(`${action}\0${canonical(args)}`).digest("hex");

  function prune(now) {
    for (const [token, entry] of entries) if (entry.expiresAt < now) entries.delete(token);
  }

  return {
    issue(action, args) {
      const now = clock();
      prune(now);
      const token = randomUUID();
      entries.set(token, { key: keyFor(action, args), expiresAt: now + ttlMs });
      return token;
    },
    consume(action, args, token) {
      const entry = entries.get(token);
      if (!entry) return false;
      entries.delete(token);
      if (entry.expiresAt < clock()) return false;
      return entry.key === keyFor(action, args);
    },
  };
}
