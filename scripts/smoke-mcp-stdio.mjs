#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

const entry = process.env.OUTREACH_MCP_SERVER_ENTRY || resolve("dist/outreach-mcp.js");
const client = new Client({ name: "outreach-smoke", version: "0.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  env: { ...process.env, OUTREACH_MCP_BACKEND_URL: process.env.OUTREACH_MCP_BACKEND_URL || "http://127.0.0.1:43127" },
});

try {
  await client.connect(transport);
  const tools = await client.listTools();
  console.log(`TOOLS (${tools.tools.length}): ${tools.tools.map((tool) => tool.name).join(", ")}`);
  const result = await client.callTool({ name: process.argv[2] || "outreach_health", arguments: process.argv[3] ? JSON.parse(process.argv[3]) : {} });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await client.close();
}
