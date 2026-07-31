import { resolve } from "node:path";
import { openDatabase } from "../backend/database.js";

const requested = process.argv[2] || process.env.OUTREACH_DATABASE || "data/outreach.sqlite";
if (requested.includes("\0")) throw new Error("Database path contains an invalid character.");
const databasePath = requested === ":memory:" ? requested : resolve(requested);
const database = openDatabase(databasePath);
const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
database.close();

console.log(JSON.stringify({
  initialized: true,
  databasePath,
  tables,
}, null, 2));
