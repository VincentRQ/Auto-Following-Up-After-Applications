#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "build", "mcp");
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, "dist"), { recursive: true });
cpSync(join(root, "dist", "outreach-mcp.js"), join(stage, "dist", "outreach-mcp.js"));
for (const name of ["manifest.json", "README.md", "PRIVACY.md", "SECURITY.md", "LICENSE", "NOTICE"]) {
  if (existsSync(join(root, name))) cpSync(join(root, name), join(stage, name));
}
cpSync(join(root, "assets"), join(stage, "assets"), { recursive: true });
console.log(`Staged MCPB contents at ${stage}`);
