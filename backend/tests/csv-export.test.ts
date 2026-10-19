import { describe, expect, it } from "vitest";
import { csvCell } from "../../frontend/src/lib/csv";

describe("CSV injection prevention", () => {
  it("prefixes formula characters instead of allowing spreadsheet evaluation", () => {
    expect(csvCell("=SUM(1,2)")).toBe("'=SUM(1,2)");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("-10+42")).toBe("'-10+42");
    expect(csvCell("@HYPERLINK(A1)")).toBe("'@HYPERLINK(A1)");
  });

  it("neutralizes formulas after leading spaces, tabs or newlines", () => {
    expect(csvCell("   =1+1")).toBe("'   =1+1");
    expect(csvCell("\t=1+1")).toBe("'\t=1+1");
    expect(csvCell("\n@SUM(A1)")).toBe('"\'\n@SUM(A1)"');
  });

  it("quotes CSV delimiters and doubles embedded quotes", () => {
    expect(csvCell('Customer, "A"')).toBe('"Customer, ""A"""');
    expect(csvCell("Normal name")).toBe("Normal name");
  });
});
