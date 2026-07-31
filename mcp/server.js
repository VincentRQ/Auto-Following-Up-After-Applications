#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadMcpConfig } from "./config.js";
import { createOutreachMcpServer } from "./server-core.js";

const config = loadMcpConfig();
const server = createOutreachMcpServer(config);
await server.connect(new StdioServerTransport());
process.stderr.write(`[outreach-console-mcp] ready; backend=${config.backendUrl}\n`);
