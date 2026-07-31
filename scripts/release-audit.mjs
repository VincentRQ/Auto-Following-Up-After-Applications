#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
);
const files = output.split("\0").filter(Boolean).map((file) => file.replaceAll("\\", "/"));
for (const generatedRoot of ["dist", "build/mcp"]) {
  const absolute = resolve(root, generatedRoot);
  if (existsSync(absolute)) files.push(...walkFiles(absolute).map((file) => relative(root, file).replaceAll("\\", "/")));
}
files.sort();
const failures = [];

const riskyExtensions = new Set([
  ".db", ".doc", ".docx", ".eml", ".msg", ".ost", ".pdf", ".pst",
  ".sqlite", ".sqlite3", ".xls", ".xlsm", ".xlsx",
]);
const textExtensions = new Set([
  "", ".css", ".csv", ".env", ".example", ".html", ".js", ".json",
  ".md", ".mjs", ".mmd", ".sql", ".svg", ".ts", ".tsx", ".txt",
  ".yaml", ".yml",
]);
const allowedDataFiles = new Set([
  "data/local-config.example.json",
  "data/sample-applications.csv",
]);
const publicContact = ["Vin", "cent", "@Rosette.Solutions"].join("");
const personalTerms = [
  ["V", "Quim"].join(""),
  ["Vinc", "enzo"].join(""),
  ["Ryu", "ma"].join(""),
  ["Vin", "centRQ"].join(""),
];

for (const file of files) {
  const absolute = resolve(root, file);
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) failures.push(`${file}: symbolic links are not allowed in a release`);
  if (stat.size > 8 * 1024 * 1024) failures.push(`${file}: tracked file exceeds the 8 MiB release limit`);

  const lower = file.toLowerCase();
  const extension = extname(lower);
  if (riskyExtensions.has(extension) || /\.sqlite(?:[-.].*)?$/i.test(file)) {
    failures.push(`${file}: private document or database type is not allowed`);
  }
  if ((lower === ".env" || (lower.startsWith(".env.") && lower !== ".env.example"))) {
    failures.push(`${file}: environment files other than .env.example are not allowed`);
  }
  if ((lower.startsWith("data/") || lower.includes("/data/")) && !allowedDataFiles.has(lower)) {
    failures.push(`${file}: only public example data may be tracked`);
  }
  if (/^(?:data\/backups|data\/private|data\/provider-work)\//i.test(file) || lower === "data/local-config.json") {
    failures.push(`${file}: private operational path is not allowed`);
  }

  const bytes = readFileSync(absolute);
  let content = bytes.toString("utf8");
  if (file === "docs/APPLICATION_PROCESS_GUIDE.md") content = content.replaceAll(publicContact, "[PUBLIC_CONTACT]");

  for (const term of personalTerms) {
    if (content.toLowerCase().includes(term.toLowerCase())) failures.push(`${file}: contains a private identity marker`);
  }
  if (new RegExp(["Vin", "cent"].join(""), "i").test(content)) failures.push(`${file}: contains a personal name outside the approved public contact`);
  if (/@outlook\.com\b|@hotmail\.com\b/i.test(content)) failures.push(`${file}: contains a personal mailbox domain`);
  if (/(?:[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s]+|\/Users\/[^/\s]+|\/home\/[^/\s]+)/i.test(content)) {
    failures.push(`${file}: contains a user-specific local path`);
  }

  if (!textExtensions.has(extension) && bytes.includes(0)) continue;
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\bAIza[A-Za-z0-9_-]{30,}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
    /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9._~+/-]{16,}/i,
  ];
  if (secretPatterns.some((pattern) => pattern.test(content))) failures.push(`${file}: resembles a committed credential`);
}

if (!files.length) failures.push("No release files were found.");
if (failures.length) {
  console.error("Release audit failed:");
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release audit passed for ${files.length} public files.`);

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else files.push(path);
  }
  return files;
}
