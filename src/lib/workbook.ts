import readXlsxWorkbook from "read-excel-file/browser";
import type { JobRow, JobStatus, ProfileKey, WorkbookImportResult } from "../types";
import { csvCell } from "./csv";
import { profileKeyFromLabel } from "./profiles";

type RawRow = Record<string, unknown>;
export type WorkbookSheetInput = { sheet: string; data: unknown[][] };

const COLUMN_ALIASES = {
  profile: ["profile", "profile_key", "resume_profile", "track"],
  company: ["company", "company_name", "organization", "employer"],
  roleTitle: ["job_title", "role_title", "title", "position", "position_title", "job_position", "role"],
  jobDescription: ["job_description", "description", "posting_description", "role_description", "description_of_job_pasted"],
  jobUrl: ["job_url", "url", "link", "application_url", "posting_url"],
  jobId: ["job_id", "position_id", "req_id", "requisition_id", "listing_id", "source_listing_id"],
  source: ["source", "board", "ats", "job_board", "listing_site"],
  status: ["status", "application_status", "outreach_status", "stage"],
  statusDetail: ["status_detail", "stage_detail", "original_stage"],
  appliedAt: ["applied_at", "applied_date", "date_applied", "application_date", "apply_date", "relevant_date"],
  lastWorkedAt: ["last_worked_at", "last_touched", "updated_at", "worked_at"],
  sentAt: ["sent_at", "outreach_sent_at", "email_sent_at"],
  contactsFound: ["contacts_found", "contact_count", "clean_contacts", "verified_contacts"],
  notes: ["notes", "comments", "outreach_notes", "contact_notes", "personal_notes"],
} as const;

export const REQUIRED_COLUMNS = ["company", "job_title", "job_url"] as const;
export const RECOMMENDED_COLUMNS = ["job_description", "profile", "job_id", "status", "applied_at"] as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

export async function importWorkbook(file: File): Promise<WorkbookImportResult> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const sheets = isCsv ? [{ sheet: "CSV", data: parseCsv(await file.text()) }] : await parseXlsxFile(file);
  return importWorkbookSheets(sheets, file.name);
}

export function importWorkbookSheets(sheets: WorkbookSheetInput[], fileName: string, importedAt = new Date().toISOString()): WorkbookImportResult {
  const warnings: string[] = [];
  const usable = sheets.map(analyzeSheet).filter((sheet) => sheet.usable);
  const selected = usable.length ? usable : sheets.map(analyzeSheet).filter((sheet) => sheet.headerIndex >= 0).slice(0, 1);
  const importedSheets = selected.map((sheet) => sheet.name);
  const ignoredSheets = sheets.map((sheet) => sheet.sheet).filter((name) => !importedSheets.includes(name));
  const rawRows = selected.flatMap((sheet) => rowsToObjects(sheet.data, sheet.headerIndex).map((row, index) => ({ row, sheetName: sheet.name, originalRow: sheet.headerIndex + index + 2 })));
  const columns = Array.from(new Set(selected.flatMap((sheet) => sheet.headers.map((header) => String(header ?? "")).filter(Boolean))));
  const normalizedColumns = new Set(columns.map(normalizeHeader));
  const missingRequiredColumns = REQUIRED_COLUMNS.filter((column) => !hasLogicalColumn(normalizedColumns, column));
  const rows = rawRows.map(({ row, sheetName, originalRow }) => normalizeRow(row, originalRow, importedAt, sheetName));

  const missingCompany = rows.filter((row) => !row.company).length;
  const missingRole = rows.filter((row) => !row.roleTitle).length;
  const missingUrl = rows.filter((row) => !row.jobUrl).length;
  if (missingCompany) warnings.push(`${missingCompany} rows missing company`);
  if (missingRole) warnings.push(`${missingRole} rows missing role title`);
  if (missingUrl) warnings.push(`${missingUrl} rows missing job URL`);
  if (missingRequiredColumns.length) warnings.unshift(`Missing required columns: ${missingRequiredColumns.join(", ")}`);
  if (ignoredSheets.length) warnings.push(`Ignored non-application sheets: ${ignoredSheets.join(", ")}`);

  return {
    fileName,
    sheetName: importedSheets.join(", ") || "No usable sheet",
    rows,
    warnings,
    columns,
    missingRequiredColumns,
    availableSheets: sheets.map((sheet) => sheet.sheet),
    importedSheets,
  };
}

async function parseXlsxFile(file: File): Promise<WorkbookSheetInput[]> {
  return await readXlsxWorkbook(file) as unknown as WorkbookSheetInput[];
}

function analyzeSheet(input: WorkbookSheetInput) {
  const headerIndex = detectHeaderIndex(input.data);
  const headers = headerIndex >= 0 ? input.data[headerIndex] : [];
  const normalized = new Set(headers.map((header) => normalizeHeader(String(header ?? ""))));
  const name = input.sheet || "Sheet";
  const excludedByName = /^(network contact|untouchable|notes)$/i.test(name.trim());
  const hasCompany = hasColumnAlias(normalized, "company");
  const hasJobContext = hasColumnAlias(normalized, "job_url") || hasColumnAlias(normalized, "description") || hasColumnAlias(normalized, "stage");
  return { name, data: input.data, headerIndex, headers, usable: !excludedByName && headerIndex >= 0 && hasCompany && hasJobContext };
}

function rowsToObjects(rows: unknown[][], headerIndex = 0): RawRow[] {
  const headers = rows[headerIndex] ?? [];
  const body = rows.slice(headerIndex + 1);
  return body
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => {
      const record: RawRow = {};
      headers.forEach((header, index) => {
        record[String(header ?? `column_${index + 1}`)] = row[index] ?? "";
      });
      return record;
    });
}

function detectHeaderIndex(rows: unknown[][]): number {
  const aliases = new Set<string>(Object.values(COLUMN_ALIASES).flat() as readonly string[]);
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 15).forEach((row, index) => {
    const normalized = row.map((value) => normalizeHeader(String(value ?? "")));
    const score = normalized.reduce((total, value) => total + (aliases.has(value) ? 1 : 0), 0);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestScore >= 2 ? bestIndex : -1;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

export function normalizeProfile(value: unknown): ProfileKey {
  const text = String(value ?? "").trim().toLowerCase();
  if (["da", "data analyst", "data analytics", "analyst"].includes(text)) return "data_analyst";
  if (["ba", "business analyst", "business analytics"].includes(text)) return "business_analyst";
  if (text.includes("data")) return "data_analyst";
  if (text.includes("business")) return "business_analyst";
  return profileKeyFromLabel(text || "unassigned");
}

export function normalizeStatus(value: unknown): JobStatus {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "unknown";
  if (/didn['’]?t pass|didin['’]?t pass|not selected|rejection|rejected|other candidates|declined/.test(text)) return "rejected";
  if (/bounce|undeliverable|delivery failed|invalid email/.test(text)) return "bounced";
  if (/interview|screening|phone screen|offer extended|offer received|final round/.test(text)) return "interview";
  if (/application received|under review|confirmation/.test(text)) return "application_received";
  if (/human reply|replied|responded/.test(text)) return "replied";
  if (text.includes("sent") || text.includes("outreach_sent")) return "sent";
  if (text.includes("draft")) return "drafted";
  if (text.includes("queue")) return "queued";
  if (text.includes("review") || text.includes("missing")) return "needs_review";
  if (text.includes("skip")) return "skipped";
  if (text.includes("apply") || text.includes("appli") || text.includes("resume")) return "applied";
  return "unknown";
}

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function findValue(rawRow: RawRow, key: ColumnKey): unknown {
  const normalized = new Map<string, unknown>();
  for (const [header, value] of Object.entries(rawRow)) {
    normalized.set(normalizeHeader(header), value);
  }
  for (const alias of COLUMN_ALIASES[key]) {
    if (normalized.has(alias)) return normalized.get(alias);
  }
  return "";
}

function normalizeRow(rawRow: RawRow, originalRow: number, importedAt: string, sheetName = "Imported"): JobRow {
  const profileValue = findValue(rawRow, "profile");
  const company = cleanText(findValue(rawRow, "company"));
  const jobDescription = cleanText(findValue(rawRow, "jobDescription"));
  const roleTitle = cleanText(findValue(rawRow, "roleTitle")) || deriveRoleTitle(jobDescription);
  const jobUrl = cleanText(findValue(rawRow, "jobUrl"));
  const jobId = cleanText(findValue(rawRow, "jobId")) || deriveJobId(jobUrl, company, roleTitle, originalRow);
  const inferredProfile = cleanText(profileValue) || inferProfileFromSheet(sheetName);
  const profile = normalizeProfile(inferredProfile);
  const normalizedStatus = cleanText(findValue(rawRow, "status"));
  const statusDetail = cleanText(findValue(rawRow, "statusDetail")) || normalizedStatus;
  const status = normalizeStatus(normalizedStatus || statusDetail);
  const appliedAt = normalizeDate(findValue(rawRow, "appliedAt"));
  const explicitSentAt = normalizeDate(findValue(rawRow, "sentAt"));
  const contactEmail = cleanText(findRawValue(rawRow, ["contact_email", "email", "hr_email"]));
  return {
    id: `${stableSlug(sheetName)}-${originalRow}-${profile}-${stableSlug(company)}-${stableSlug(roleTitle)}-${stableSlug(jobId)}`,
    originalRow,
    profile,
    profileLabel: inferredProfile,
    company,
    roleTitle,
    jobDescription,
    jobUrl,
    jobId,
    source: cleanText(findValue(rawRow, "source")) || sheetName,
    status,
    statusDetail,
    appliedAt,
    lastWorkedAt: normalizeDate(findValue(rawRow, "lastWorkedAt")) || appliedAt,
    sentAt: explicitSentAt || (status === "sent" ? appliedAt : ""),
    contactsFound: normalizeNumber(findValue(rawRow, "contactsFound")) ?? (contactEmail.includes("@") ? 1 : null),
    notes: cleanText(findValue(rawRow, "notes")),
    importedAt,
    extraFields: collectExtraFields(rawRow),
  };
}

function findRawValue(rawRow: RawRow, aliases: string[]): unknown {
  const wanted = new Set(aliases);
  for (const [header, value] of Object.entries(rawRow)) {
    if (wanted.has(normalizeHeader(header))) return value;
  }
  return "";
}

function inferProfileFromSheet(sheetName: string): string {
  const normalized = sheetName.toLowerCase();
  if (normalized.includes("biz") || normalized.includes("business")) return "BA";
  if (normalized.includes("data")) return "DA";
  return "unassigned";
}

function deriveRoleTitle(description: string): string {
  const line = description.split(/\r?\n/).map((value) => value.trim()).find(Boolean) ?? "";
  return line.replace(/<[^>]+>/g, "").slice(0, 140);
}

export function serializeJobsToCsv(rows: JobRow[]): string {
  const baseHeaders = [
    "profile", "company", "job_title", "job_description", "job_url", "job_id", "source", "status", "status_detail",
    "applied_at", "last_worked_at", "sent_at", "contacts_found", "notes",
  ];
  const extraHeaders = Array.from(new Set(rows.flatMap((row) => Object.keys(row.extraFields ?? {}))))
    .filter((header) => !baseHeaders.includes(normalizeHeader(header)));
  const headers = [...baseHeaders, ...extraHeaders];
  const values = rows.map((row) => {
    const base: Record<string, unknown> = {
      profile: row.profileLabel || row.profile,
      company: row.company,
      job_title: row.roleTitle,
      job_description: row.jobDescription,
      job_url: row.jobUrl,
      job_id: row.jobId,
      source: row.source,
      status: row.status,
      status_detail: row.statusDetail ?? "",
      applied_at: row.appliedAt,
      last_worked_at: row.lastWorkedAt,
      sent_at: row.sentAt,
      contacts_found: row.contactsFound ?? "",
      notes: row.notes,
      ...row.extraFields,
    };
    return headers.map((header) => csvCell(base[header] ?? "")).join(",");
  });
  return `${headers.map(csvCell).join(",")}\n${values.join("\n")}\n`;
}

function collectExtraFields(rawRow: RawRow): Record<string, string> {
  const knownAliases = new Set<string>(Object.values(COLUMN_ALIASES).flat() as readonly string[]);
  return Object.fromEntries(
    Object.entries(rawRow)
      .filter(([header]) => !knownAliases.has(normalizeHeader(header)))
      .map(([header, value]) => [header, cleanText(value)]),
  );
}

function hasColumnAlias(columns: Set<string>, canonical: string): boolean {
  const entry = Object.entries(COLUMN_ALIASES).find(([, aliases]) => (aliases as readonly string[]).includes(canonical));
  return entry ? (entry[1] as readonly string[]).some((alias) => columns.has(alias)) : columns.has(canonical);
}

function hasLogicalColumn(columns: Set<string>, canonical: string): boolean {
  if (canonical === "job_title") return hasColumnAlias(columns, canonical) || hasColumnAlias(columns, "description");
  return hasColumnAlias(columns, canonical);
}

function cleanText(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").trim();
}

function normalizeDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const text = cleanText(value);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveJobId(jobUrl: string, company: string, roleTitle: string, originalRow: number): string {
  if (jobUrl) {
    const tail = jobUrl.split(/[/?#]/).filter(Boolean).at(-1);
    if (tail) return tail.slice(0, 80);
  }
  return `${stableSlug(company)}-${stableSlug(roleTitle)}-${originalRow}`;
}

function stableSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
