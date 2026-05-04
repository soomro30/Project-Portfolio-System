import { existsSync } from "node:fs";

import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

const workbookPath =
  process.env.WORKBOOK_IMPORT_PATH ??
  "/Users/zulfiqar/Library/CloudStorage/OneDrive-SAALOperatingSystems–SoleProprietorshipLLC/SAAL Documents/IMKAN Technology Services Program Projects/Project & Program Management/IMKAN_Digital_Transformation_Portfolio_Tracker_v2_all_projects_final.xlsx";

describe("source workbook contract", () => {
  it("contains the expected sheets and row counts", () => {
    expect(existsSync(workbookPath)).toBe(true);

    const workbook = XLSX.readFile(workbookPath, { cellDates: true });

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
