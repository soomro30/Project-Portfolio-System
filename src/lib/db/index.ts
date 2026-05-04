import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

declare global {
  var __imkanSql__: postgres.Sql | undefined;
}

export function getSql() {
  if (!globalThis.__imkanSql__) {
    globalThis.__imkanSql__ = postgres(getEnv().DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return globalThis.__imkanSql__;
}

export function getDb() {
  return drizzle(getSql(), { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof getDb>;
