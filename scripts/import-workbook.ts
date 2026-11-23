import "dotenv/config";

import { importWorkbookToDatabase } from "@/lib/import/workbook";
import { getSql } from "@/lib/db";
import { getEnv } from "@/lib/env";

async function main() {
  const summary = await importWorkbookToDatabase(getEnv().WORKBOOK_IMPORT_PATH);
  console.log(summary);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => getSql().end());
