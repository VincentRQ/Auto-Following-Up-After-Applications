#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync } from "node:fs";
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
  ".sqlite", ".sqlite3", ".xls", ".xlsb", ".xlsm", ".xlsx", ".ods",
]);
const textExtensions = new Set([
  "", ".css", ".csv", ".env", ".example", ".html", ".js", ".json",
  ".md", ".mjs", ".mmd", ".sql", ".svg", ".ts", ".tsx", ".txt",
  ".yaml", ".yml",
]);
const allowedDataFiles = new Set([
  "data/local-config.example.json",
  "data/sample-applications.csv",
  "data/sample-recruiter-contacts.csv",
]);
const publicContact = ["Vin", "cent", "@Rosette.Solutions"].join("");
const publicRepository = ["https://github.com/", "Vin", "centRQ/Auto-Following-Up-After-Applications"].join("");
const publicRepositorySlug = ["Vin", "centRQ/Auto-Following-Up-After-Applications"].join("");
const publicMaintainer = ["Vin", "cent Quimby"].join("");
const publicAccount = ["Vin", "centRQ"].join("");
const publicMaintainerAssignment = `  - ${["Vin", "centRQ"].join("")}`;
const personalTerms = [
  ["V", "Quim"].join(""),
  ["Vinc", "enzo"].join(""),
  ["Ryu", "ma"].join(""),
  ["Vin", "centRQ"].join(""),
];
const personalMailboxDomains = [["out", "look"].join(""), ["hot", "mail"].join("")];
const personalMailboxPattern = new RegExp(`@(?:${personalMailboxDomains.join("|")})\\.com\\b`, "i");

for (const file of files) {
  const absolute = resolve(root, file);
  const descriptor = openSync(absolute, "r");
  let bytes;
  let stat;
  try {
    stat = fstatSync(descriptor);
    const before = lstatSync(absolute);
    if (before.isSymbolicLink()) failures.push(`${file}: symbolic links are not allowed in a release`);
    if (before.dev !== stat.dev || before.ino !== stat.ino) failures.push(`${file}: file identity changed while it was opened`);
    bytes = readFileSync(descriptor);
    const after = lstatSync(absolute);
    if (after.isSymbolicLink() || after.dev !== stat.dev || after.ino !== stat.ino || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) {
      failures.push(`${file}: file changed while it was being audited`);
    }
  } finally {
    closeSync(descriptor);
  }
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
  if (extension === ".csv" && !allowedDataFiles.has(lower)) {
    failures.push(`${file}: only allowlisted synthetic CSV files may be released`);
  }
  if (/^(?:data\/backups|data\/private|data\/provider-work)\//i.test(file) || lower === "data/local-config.json") {
    failures.push(`${file}: private operational path is not allowed`);
  }

  let content = bytes.toString("utf8")
    .replaceAll(publicContact, "[PUBLIC_CONTACT]")
    .replaceAll(publicRepository, "[PUBLIC_REPOSITORY]")
    .replaceAll(publicRepositorySlug, "[PUBLIC_REPOSITORY]")
    .replaceAll(publicMaintainer, "[PUBLIC_MAINTAINER]")
    .replaceAll(publicMaintainerAssignment, "  - [PUBLIC_MAINTAINER]");

  for (const term of personalTerms) {
    if (content.toLowerCase().includes(term.toLowerCase())) failures.push(`${file}: contains a private identity marker`);
  }
  if (new RegExp(["Vin", "cent"].join(""), "i").test(content)) failures.push(`${file}: contains a personal name outside the approved public contact`);
  if (personalMailboxPattern.test(content)) failures.push(`${file}: contains a personal mailbox domain`);
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

for (const file of gitHistoryPaths()) {
  const lower = file.toLowerCase();
  const extension = extname(lower);
  const unapprovedCsv = extension === ".csv" && !allowedDataFiles.has(lower);
  if (riskyExtensions.has(extension) || unapprovedCsv || /recruiter[\s_-]*contact/i.test(file) && !/sample-recruiter-contacts\.csv$/i.test(file)) {
    failures.push(`${file}: private workbook or contact export exists in Git history`);
  }
}

for (const marker of [...personalTerms.filter((term) => term !== publicAccount), ...personalMailboxDomains.map((domain) => `@${domain}.com`)]) {
  if (gitHistoryContains(marker)) failures.push(`Git history contains a private identity or mailbox marker`);
}

for (const sampleFile of ["data/sample-applications.csv", "data/sample-recruiter-contacts.csv"]) {
  if (!files.includes(sampleFile)) failures.push(`${sampleFile}: required synthetic sample is missing`);
  else {
    const sample = readFileSync(resolve(root, sampleFile), "utf8");
    if (/@(?![a-z0-9.-]*\.invalid\b)/i.test(sample)) failures.push(`${sampleFile}: sample email does not use the reserved .invalid domain`);
    if (/https?:\/\/(?![a-z0-9.-]*\.invalid(?:\/|$))/i.test(sample)) failures.push(`${sampleFile}: sample link does not use the reserved .invalid domain`);
  }
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

function gitHistoryPaths() {
  try {
    return execFileSync("git", ["rev-list", "--objects", "HEAD"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.replace(/^[0-9a-f]+\s+/, "").trim())
      .filter(Boolean);
  } catch {
    failures.push("Unable to inspect Git history for private workbook paths");
    return [];
  }
}

function gitHistoryContains(marker) {
  try {
    const output = execFileSync("git", ["log", "HEAD", `-S${marker}`, "--format=%H", "--"], { cwd: root, encoding: "utf8" });
    return Boolean(output.trim());
  } catch {
    failures.push("Unable to inspect Git history content for private markers");
    return false;
  }
}
