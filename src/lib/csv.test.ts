import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("CSV output", () => {
  it("quotes delimiters and embedded quotes", () => {
    expect(csvCell('hello, "world"')).toBe('"hello, ""world"""');
  });

  it("neutralizes formula-leading spreadsheet cells", () => {
    expect(csvCell("=2+2")).toBe("'=2+2");
    expect(csvCell("  @SUM(A1:A2)")).toBe("'  @SUM(A1:A2)");
    expect(csvCell("ordinary text")).toBe("ordinary text");
  });
});
