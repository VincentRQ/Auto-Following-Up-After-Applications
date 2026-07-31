#!/usr/bin/env node
import { chmodSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = join(root, "dist", "outreach-mcp.js");
mkdirSync(dirname(outfile), { recursive: true });
await build({
  entryPoints: [join(root, "mcp", "server.js")],
  outfile,
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});
chmodSync(outfile, 0o755);
console.log(`Built MCP plugin bundle: ${outfile} (${Math.ceil(statSync(outfile).size / 1024)} KB)`);
