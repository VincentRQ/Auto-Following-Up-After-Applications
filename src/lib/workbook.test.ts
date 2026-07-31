import { describe, expect, it } from "vitest";
import readWorkbook from "read-excel-file/node";
import { findValue, importWorkbook, importWorkbookSheets, normalizeHeader, normalizeProfile, normalizeStatus, serializeJobsToCsv, type WorkbookSheetInput } from "./workbook";

describe("workbook normalization", () => {
  it("normalizes common profile values", () => {
    expect(normalizeProfile("DA")).toBe("data_analyst");
    expect(normalizeProfile("Business Analyst")).toBe("business_analyst");
    expect(normalizeProfile("Product Manager")).toBe("product_manager");
  });

  it("normalizes headers", () => {
    expect(normalizeHeader("Job URL")).toBe("job_url");
    expect(normalizeHeader("sourceListingId")).toBe("source_listing_id");
  });

  it("finds aliased columns", () => {
    expect(findValue({ Company: "Acme", "Job URL": "https://example.com" }, "company")).toBe("Acme");
    expect(findValue({ Company: "Acme", "Job URL": "https://example.com" }, "jobUrl")).toBe("https://example.com");
  });

  it("detects sent and applied statuses", () => {
    expect(normalizeStatus("Resume + CL Sent")).toBe("sent");
    expect(normalizeStatus("Applied")).toBe("applied");
    expect(normalizeStatus("Interview + Awaiting response")).toBe("interview");
    expect(normalizeStatus("Didn't pass final round interview")).toBe("rejected");
  });

  it("finds shifted headers, imports multiple job sheets, and ignores contact-only sheets", () => {
    const result = importWorkbookSheets([
      { sheet: "Interviews+Etc.", data: [["instructions"], ["more instructions"], ["Company", "Profile", "Job URL", "Stage", "Apply Date", "Description of Job (Pasted)"], ["Acme", "DA", "https://example.com/1", "Interview", "2026-07-01", "Data Analyst\nDetails"]] },
      { sheet: "Biz Analyst", data: [["Company", "Job URL", "Stage", "Relevant Date", "Description of Job (Pasted)"], ["Beta", "https://example.com/2", "Resume + CL Sent", "2026-07-02", "Business Analyst\nDetails"]] },
      { sheet: "Network Contact", data: [["Company Name", "HR Email", "HR First Name"], ["Acme", "person@example.com", "Pat"]] },
    ], "recruiter.xlsx", "2026-07-03T00:00:00.000Z");

    expect(result.importedSheets).toEqual(["Interviews+Etc.", "Biz Analyst"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].roleTitle).toBe("Data Analyst");
    expect(result.rows[1].profile).toBe("business_analyst");
    expect(result.rows[1].sentAt).toBe("2026-07-02T00:00:00.000Z");
  });

  it("neutralizes markup characters in role titles derived from descriptions", () => {
    const result = importWorkbookSheets([
      {
        sheet: "Applications",
        data: [
          ["Company", "Job URL", "Description"],
          ["Acme", "https://example.com/role", "<scr<script>ipt>alert(1)</scr</script>ipt>\nRole details"],
        ],
      },
    ], "applications.xlsx", "2026-07-03T00:00:00.000Z");

    expect(result.rows[0].roleTitle).not.toMatch(/[<>]/);
  });

  const qaWorkbook = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OUTREACH_QA_WORKBOOK;
  (qaWorkbook ? it : it.skip)("imports the operator workbook without exposing its contents", async () => {
    const sheets = await readWorkbook(qaWorkbook!) as unknown as WorkbookSheetInput[];
    const result = importWorkbookSheets(sheets, "operator-workbook.xlsx");
    expect(result.importedSheets).toContain("Biz Analyst");
    expect(result.importedSheets).toContain("Data Analyst");
    expect(result.rows.length).toBeGreaterThan(1000);
    expect(result.rows.filter((row) => row.company).length / result.rows.length).toBeGreaterThan(0.98);
    expect(result.rows.filter((row) => row.roleTitle).length / result.rows.length).toBeGreaterThan(0.85);
    expect(result.warnings.some((warning) => warning.includes("missing role title"))).toBe(true);
  });

  it("reports missing required columns before rows are used", async () => {
    const file = new File(["company,job_title\nAcme,Analyst\n"], "applications.csv", { type: "text/csv" });
    const result = await importWorkbook(file);
    expect(result.missingRequiredColumns).toEqual(["job_url"]);
    expect(result.warnings[0]).toContain("job_url");
  });

  it("round-trips managed fields and preserves unknown columns", async () => {
    const file = new File([
      "profile,company,job_title,job_description,job_url,status,status_detail,custom_owner\nDA,Acme,Data Analyst,Build KPI reporting,https://example.com/jobs/1,interview,Final interview scheduled,Jordan\n",
    ], "applications.csv", { type: "text/csv" });
    const imported = await importWorkbook(file);
    expect(imported.rows[0].status).toBe("interview");
    expect(imported.rows[0].statusDetail).toBe("Final interview scheduled");
    const csv = serializeJobsToCsv(imported.rows);
    expect(csv).toContain("job_description");
    expect(csv).toContain("Build KPI reporting");
    expect(csv).toContain("custom_owner");
    expect(csv).toContain("Jordan");
    expect(csv).toContain("Final interview scheduled");
  });
});
