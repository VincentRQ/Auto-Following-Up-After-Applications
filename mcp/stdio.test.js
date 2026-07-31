import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("stdio MCP lists safe defaults and enforces preview-before-import", async () => {
  let importCalls = 0;
  const backend = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/health") {
      response.end(JSON.stringify({ status: "ok", providers: { database: "ready" } }));
      return;
    }
    if (request.url === "/api/import/applications" && request.method === "POST") {
      importCalls += 1;
      for await (const _chunk of request) { /* drain */ }
      response.statusCode = 201;
      response.end(JSON.stringify({ imported: 1 }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "Not found" }));
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const backendUrl = `http://127.0.0.1:${backend.address().port}`;
  const client = new Client({ name: "qa", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["mcp/server.js"],
    cwd: process.cwd(),
    env: { ...process.env, OUTREACH_MCP_BACKEND_URL: backendUrl },
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    assert.ok(names.includes("outreach_health"));
    assert.ok(names.includes("outreach_import_applications"));
    assert.equal(names.includes("outreach_get_company"), false);
    assert.equal(names.includes("outreach_mailbox_events"), false);
    assert.equal(names.includes("outreach_list_message_drafts"), false);
    assert.equal(names.includes("outreach_generate_messages"), false);
    assert.equal(names.includes("outreach_send_email"), false);

    const health = await client.callTool({ name: "outreach_health", arguments: {} });
    assert.equal(health.isError ?? false, false);
    assert.equal(health.structuredContent.result.status, "ok");

    const args = { source: "synthetic", applications: [{ company: "Example", role_title: "Analyst", job_url: "https://example.test/job" }] };
    const preview = await client.callTool({ name: "outreach_import_applications", arguments: args });
    assert.equal(preview.structuredContent.requiresConfirmation, true);
    assert.equal(importCalls, 0);

    const confirmed = await client.callTool({ name: "outreach_import_applications", arguments: { ...args, confirm: preview.structuredContent.confirmToken } });
    assert.equal(confirmed.isError ?? false, false);
    assert.equal(confirmed.structuredContent.result.imported, 1);
    assert.equal(importCalls, 1);

    const replay = await client.callTool({ name: "outreach_import_applications", arguments: { ...args, confirm: preview.structuredContent.confirmToken } });
    assert.equal(replay.isError, true);
    assert.equal(importCalls, 1);
  } finally {
    await client.close();
    await new Promise((resolve) => backend.close(resolve));
  }
});

test("contact and provider opt-ins do not bypass the separate live-send lock", async () => {
  const client = new Client({ name: "send-lock-qa", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["mcp/server.js"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      OUTREACH_MCP_BACKEND_URL: "http://127.0.0.1:1",
      OUTREACH_MCP_EXPOSE_CONTACTS: "1",
      OUTREACH_MCP_ENABLE_PROVIDER_ACTIONS: "1",
      OUTREACH_MCP_ENABLE_LIVE_SEND: "0",
    },
  });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "outreach_send_email"));
    assert.ok(tools.tools.some((tool) => tool.name === "outreach_list_message_drafts"));
    assert.ok(tools.tools.some((tool) => tool.name === "outreach_save_message_draft"));
    assert.ok(tools.tools.some((tool) => tool.name === "outreach_generate_messages"));
    const result = await client.callTool({
      name: "outreach_send_email",
      arguments: { companyId: 1, jobId: 1, contactId: 1, subject: "Safety QA", body: "This must not send." },
    });
    assert.equal(result.isError, true);
    assert.match(result.structuredContent.message, /Live sends are disabled/);
  } finally {
    await client.close();
  }
});
