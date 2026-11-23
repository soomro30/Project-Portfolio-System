import "dotenv/config";

import { importWorkbookToDatabase } from "@/lib/import/workbook";
import { getSql } from "@/lib/db";
import { getEnv } from "@/lib/env";

async function main() {
  const { WORKBOOK_IMPORT_PATH: workbookPath } = getEnv();
  if (!workbookPath) throw new Error("Set WORKBOOK_IMPORT_PATH to the source workbook.");
  const summary = await importWorkbookToDatabase(workbookPath);
  console.log(summary);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => getSql().end());
