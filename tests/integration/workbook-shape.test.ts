import "dotenv/config";

import { existsSync } from "node:fs";

import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

const workbookPath = process.env.WORKBOOK_IMPORT_PATH;

describe.skipIf(!workbookPath)("source workbook contract", () => {
  it("contains the expected sheets and row counts", () => {
    expect(workbookPath && existsSync(workbookPath)).toBe(true);

    const workbook = XLSX.readFile(workbookPath!, { cellDates: true });

    expect(workbook.SheetNames).toEqual(["Portfolio Summary", "Week Updates", "Lists"]);

    const portfolioRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets["Portfolio Summary"],
      { defval: null, range: 5 },
    ).filter((row) => row["Project ID"] && row["Project Name"]);

    const weeklyRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets["Week Updates"],
      { defval: null, range: 2 },
    ).filter((row) => row["Project ID"] && row["Project Name"]);

    expect(portfolioRows).toHaveLength(36);
    expect(weeklyRows).toHaveLength(9);
  });
});
