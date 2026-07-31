#!/usr/bin/env node
/** Read configured inboxes and record application, reply, and next-step events. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../backend/database.js";
import { createProviders } from "../backend/providers.js";
import { createService } from "../backend/service.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const configPath = resolve(process.argv[2] || `${root}/data/local-config.json`);
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.configPath = configPath;
const databasePath = resolve(process.argv[3] || `${root}/data/outreach.sqlite`);
const top = Math.max(1, Math.min(200, Number(process.argv[4] || 100)));
const service = createService(openDatabase(databasePath), createProviders(config));
const result = await service.syncMailbox({ top, apply: true });
console.log(JSON.stringify(result, null, 2));
