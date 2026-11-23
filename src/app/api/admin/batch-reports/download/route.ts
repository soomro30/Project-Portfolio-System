import { readFile } from "node:fs/promises";

import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/session";
import { assertSafeBatchReportPath } from "@/lib/reports/pdf-generator";
import { apiErrorResponse, RequestError } from "@/lib/utils/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRole(["admin"]);
    const runId = request.nextUrl.searchParams.get("runId") ?? "";
    const fileName = request.nextUrl.searchParams.get("file") ?? "";
    const filePath = assertSafeBatchReportPath(runId, fileName);
    const file = await readFile(filePath);
    const contentType = fileName.endsWith(".html") ? "text/html; charset=utf-8" : "application/pdf";

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    return apiErrorResponse((error as NodeJS.ErrnoException)?.code === "ENOENT"
      ? new RequestError("Report file was not found or has expired.", 404)
      : error);
  }
}
