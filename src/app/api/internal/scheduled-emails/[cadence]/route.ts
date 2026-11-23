import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { sendBatchEmails, verifyEmailTransport } from "@/lib/email/service";
import { getBatchReportPublisher } from "@/lib/reports/batch-jobs";
import { apiErrorResponse, RequestError } from "@/lib/utils/api";

export const runtime = "nodejs";
export const maxDuration = 300;

const queue = "hosted-scheduled-status-emails";

function isAuthorized(request: NextRequest) {
  if (!process.env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

function scheduledRunId(cadence: string) {
  const date = new Date().toISOString().slice(0, 10);
  const key = createHash("sha256").update(`${queue}/${cadence}/${date}`).digest().subarray(0, 16);
  key[6] = (key[6] & 0x0f) | 0x40;
  key[8] = (key[8] & 0x3f) | 0x80;
  const hex = key.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ cadence: string }> }) {
  try {
    if (!isAuthorized(request)) throw new RequestError("Unauthorized", 401);
    const { cadence } = await params;
    if (cadence !== "weekly" && cadence !== "monthly") throw new RequestError("Unknown report cadence.", 404);

    try {
      await verifyEmailTransport();
    } catch {
      throw new RequestError("The configured mail provider could not authenticate or connect.", 503);
    }

    const boss = await getBatchReportPublisher();
    await boss.createQueue(queue, { retryLimit: 0, retentionSeconds: 7 * 86400, deleteAfterSeconds: 7 * 86400 });
    const id = await boss.send(queue, { cadence }, { id: scheduledRunId(cadence) });
    if (!id) return NextResponse.json({ duplicate: true });

    try {
      const results = await sendBatchEmails(cadence);
      const sent = results.filter((result) => result.status === "fulfilled" && result.value.status === "sent").length;
      const summary = { sent, failed: results.length - sent };
      await boss.complete(queue, id, summary, { includeQueued: true });
      return NextResponse.json(summary);
    } catch (error) {
      await boss.fail(queue, id, { message: "Scheduled email run failed." });
      throw error;
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
