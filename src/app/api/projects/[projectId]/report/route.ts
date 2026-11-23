import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getProjectsForReports } from "@/lib/domain/projects";
import { renderProjectStatusReportPdf } from "@/lib/reports/pdf-generator";
import { type ReportCadence } from "@/lib/reports/project-status-report";
import { apiErrorResponse, RequestError } from "@/lib/utils/api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser();
    const { projectId } = await context.params;
    const cadence = (request.nextUrl.searchParams.get("cadence") ?? "weekly") as ReportCadence;

    if (cadence !== "weekly" && cadence !== "monthly") {
      throw new RequestError("Invalid report cadence.");
    }

    const [project] = await getProjectsForReports(user, [projectId]);

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pdf = await renderProjectStatusReportPdf(project, cadence);
    const pdfBytes = new Uint8Array(pdf);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${project.projectCode.replace(/[^a-zA-Z0-9_-]/g, "-")}-${cadence}-status-report.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
