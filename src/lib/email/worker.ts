import { PgBoss } from "pg-boss";

import { databaseConnectionOptions } from "@/lib/db/connection";

import { sendBatchEmails } from "@/lib/email/service";
import { getEnv } from "@/lib/env";

import { BATCH_REPORT_QUEUE, ensureBatchReportQueue, processBatchReport, type BatchReportJob } from "@/lib/reports/batch-jobs";
import { pruneExpiredBatchReports } from "@/lib/reports/pdf-generator";

const REPORT_CLEANUP_JOB = "expired-report-cleanup";
const WEEKLY_JOB = "weekly-project-status";
const MONTHLY_JOB = "monthly-project-status";

export async function createBoss() {
  const boss = new PgBoss({
    ...databaseConnectionOptions(getEnv().DATABASE_URL),
    schema: "pgboss",
  });

  boss.on("error", (error) => console.error("Worker queue error:", error.message));
  await boss.start();
  await boss.createQueue(WEEKLY_JOB);
  await boss.createQueue(MONTHLY_JOB);
  await ensureBatchReportQueue(boss);
  await boss.createQueue(REPORT_CLEANUP_JOB);
  const scheduleOptions = { tz: getEnv().APP_TIMEZONE };
  await boss.schedule(WEEKLY_JOB, "0 8 * * 1", undefined, scheduleOptions);
  await boss.schedule(MONTHLY_JOB, "0 8 1 * *", undefined, scheduleOptions);
  await boss.schedule(REPORT_CLEANUP_JOB, "0 3 * * *", undefined, scheduleOptions);
  await boss.work(REPORT_CLEANUP_JOB, async () => pruneExpiredBatchReports());
  await boss.work<BatchReportJob>(BATCH_REPORT_QUEUE, { batchSize: 1, groupConcurrency: 1 }, async ([job]) =>
    processBatchReport(job.data));
  await boss.work(WEEKLY_JOB, async () => {
    await sendBatchEmails("weekly");
  });
  await boss.work(MONTHLY_JOB, async () => {
    await sendBatchEmails("monthly");
  });

  return boss;
}
