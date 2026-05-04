import { PgBoss } from "pg-boss";

import { sendBatchEmails } from "@/lib/email/service";
import { getEnv } from "@/lib/env";

const WEEKLY_JOB = "weekly-project-status";
const MONTHLY_JOB = "monthly-project-status";

export async function createBoss() {
  const boss = new PgBoss({
    connectionString: getEnv().DATABASE_URL,
    schema: "pgboss",
  });

  await boss.start();
  await boss.createQueue(WEEKLY_JOB);
  await boss.createQueue(MONTHLY_JOB);
  await boss.schedule(WEEKLY_JOB, "0 8 * * 1");
  await boss.schedule(MONTHLY_JOB, "0 8 1 * *");
  await boss.work(WEEKLY_JOB, async () => {
    await sendBatchEmails("weekly");
  });
  await boss.work(MONTHLY_JOB, async () => {
    await sendBatchEmails("monthly");
  });

  return boss;
}
