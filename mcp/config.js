function enabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

export function loadMcpConfig(env = process.env) {
  return {
    backendUrl: normalizeLoopbackBackendUrl(env.OUTREACH_MCP_BACKEND_URL || env.VITE_OUTREACH_BACKEND_URL || "http://127.0.0.1:43127"),
    exposeContacts: enabled(env.OUTREACH_MCP_EXPOSE_CONTACTS),
    exposeMailbox: enabled(env.OUTREACH_MCP_EXPOSE_MAILBOX),
    enableProviderActions: enabled(env.OUTREACH_MCP_ENABLE_PROVIDER_ACTIONS),
    enableLiveSend: enabled(env.OUTREACH_MCP_ENABLE_LIVE_SEND),
    maxRows: Math.min(500, Math.max(10, Number(env.OUTREACH_MCP_MAX_ROWS) || 100)),
  };
}

export function normalizeLoopbackBackendUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    throw new Error("OUTREACH_MCP_BACKEND_URL must be a complete loopback HTTP or HTTPS URL.");
  }
  const hostname = parsed.hostname.toLowerCase();
  const loopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
  if (!loopback) throw new Error("OUTREACH_MCP_BACKEND_URL must use localhost or a loopback address.");
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("OUTREACH_MCP_BACKEND_URL must use HTTP or HTTPS.");
  if (parsed.username || parsed.password) throw new Error("OUTREACH_MCP_BACKEND_URL must not contain credentials.");
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("OUTREACH_MCP_BACKEND_URL must not contain a path, query, or fragment.");
  return parsed.origin;
}
