import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { getDb, getSql } from "@/lib/db";

async function main() {
  await migrate(getDb(), {
    migrationsFolder: "./drizzle",
  });
  await getSql().end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
