import { readFile, rm } from "node:fs/promises";
import { and, eq, gt, lte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { reportFiles } from "@/lib/db/schema";
import { REPORT_RETENTION_SECONDS, type BatchReportResult } from "@/lib/reports/pdf-generator";
import { RequestError } from "@/lib/utils/api";

const downloadChunkBytes = 1024 * 1024;

export async function saveHostedBatchReportFiles(result: BatchReportResult) {
  const files = [
    { filename: result.combinedFileName, path: result.combinedFilePath },
    ...result.files.flatMap((file) => [
      { filename: file.fileName, path: file.filePath },
      { filename: file.editableFileName, path: file.editableFilePath },
    ]),
  ];
  const db = getDb();
  const expiresAt = new Date(new Date(result.generatedAt).getTime() + REPORT_RETENTION_SECONDS * 1000);

  try {
    await db.transaction(async (tx) => {
      for (const file of files) {
        await tx.insert(reportFiles).values({
          runId: result.runId,
          filename: file.filename,
          content: await readFile(file.path),
          expiresAt,
        });
      }
    });
  } finally {
    await rm(result.outputDir, { recursive: true, force: true });
  }
}

export async function openHostedBatchReportFile(runId: string, filename: string) {
  const db = getDb();
  const where = and(eq(reportFiles.runId, runId), eq(reportFiles.filename, filename), gt(reportFiles.expiresAt, new Date()));
  const [file] = await db.select({ size: sql<number>`octet_length(${reportFiles.content})` })
    .from(reportFiles).where(where);
  if (!file) throw new RequestError("Report file was not found or has expired.", 404);

  let sent = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const [chunk] = await db.select({
        content: sql<Buffer>`substring(${reportFiles.content} from ${sent + 1} for ${downloadChunkBytes})`,
      }).from(reportFiles).where(where);

      if (!chunk?.content.length) {
        controller.error(new Error("The report expired during download."));
        return;
      }

      sent += chunk.content.length;
      controller.enqueue(new Uint8Array(chunk.content));
      if (sent >= file.size) controller.close();
    },
  });
}

export async function pruneHostedBatchReports() {
  await getDb().delete(reportFiles).where(lte(reportFiles.expiresAt, new Date()));
}
