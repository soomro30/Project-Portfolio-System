import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getProjectForUser } from "@/lib/domain/projects";
import { renderProjectStatusReportPdf } from "@/lib/reports/pdf-generator";
import { type ReportCadence } from "@/lib/reports/project-status-report";
import { apiErrorResponse } from "@/lib/utils/api";

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
      throw new Error("Invalid report cadence");
    }

    const project = await getProjectForUser(user, projectId);

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pdf = await renderProjectStatusReportPdf(project, cadence);
    const pdfBytes = new Uint8Array(pdf);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${project.projectCode}-${cadence}-status-report.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
