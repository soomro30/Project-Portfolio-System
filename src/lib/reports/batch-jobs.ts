import { and, eq } from "drizzle-orm";
import { PgBoss } from "pg-boss";

import { getDb } from "@/lib/db";
import { auditLogs, roles, users } from "@/lib/db/schema";
import { getProjectsForReports } from "@/lib/domain/projects";
import { getEnv } from "@/lib/env";
import {
  generateBatchProjectReports,
  pruneExpiredBatchReports,
  REPORT_RETENTION_SECONDS,
} from "@/lib/reports/pdf-generator";
import type { ReportCadence } from "@/lib/reports/project-status-report";

export const BATCH_REPORT_QUEUE = "project-batch-reports";

export type BatchReportJob = {
  actorId: string;
  projectIds: string[];
  cadence: ReportCadence;
};

export async function ensureBatchReportQueue(boss: PgBoss) {
  await boss.createQueue(BATCH_REPORT_QUEUE, {
    policy: "exclusive",
    retryLimit: 0,
    expireInSeconds: 15 * 60,
    deleteAfterSeconds: REPORT_RETENTION_SECONDS,
  });
}

let publisher: Promise<PgBoss> | undefined;

export function getBatchReportPublisher() {
  publisher ??= (async () => {
    const boss = new PgBoss({
      connectionString: getEnv().DATABASE_URL,
      schema: "pgboss",
      schedule: false,
      supervise: false,
      max: 2,
    });
    boss.on("error", (error) => console.error("Batch report queue error:", error.message));
    try {
      await boss.start();
      await ensureBatchReportQueue(boss);
      return boss;
    } catch (error) {
      await boss.stop().catch(() => undefined);
      publisher = undefined;
      throw error;
    }
  })();
  return publisher;
}

export async function processBatchReport({ actorId, projectIds, cadence }: BatchReportJob) {
  const db = getDb();
  const [actor] = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users).innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, actorId), eq(users.active, true), eq(roles.name, "admin")));
  if (!actor) throw new Error("The requesting account no longer has access to batch reports.");

  const projects = await getProjectsForReports({ ...actor, role: "admin" }, projectIds);
  if (projects.length !== projectIds.length) throw new Error("The selected projects have changed.");
  await pruneExpiredBatchReports();
  const result = await generateBatchProjectReports({ projects, cadence });
  await db.insert(auditLogs).values({
    actorUserId: actorId,
    entityType: "batch_reports",
    entityId: result.runId,
    action: "generate",
    metadata: {
      cadence,
      projectCount: result.projectCount,
      projects: result.files.map(({ projectId }) => projectId),
    },
  });

  return {
    runId: result.runId,
    cadence: result.cadence,
    projectCount: result.projectCount,
    sections: result.sections,
    combinedFileName: result.combinedFileName,
    combinedDownloadUrl: downloadUrl(result.runId, result.combinedFileName),
    files: result.files.map(({ projectCode, projectName, fileName, editableFileName }) => ({
      projectCode,
      projectName,
      fileName,
      editableFileName,
      downloadUrl: downloadUrl(result.runId, fileName),
      editableDownloadUrl: downloadUrl(result.runId, editableFileName),
    })),
  };
}

function downloadUrl(runId: string, file: string) {
  return `/api/admin/batch-reports/download?${new URLSearchParams({ runId, file })}`;
}
