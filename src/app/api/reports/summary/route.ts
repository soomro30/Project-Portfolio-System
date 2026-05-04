import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getDashboardSummary, getReportSnapshot } from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const view = request.nextUrl.searchParams.get("view");

    if (view === "dashboard") {
      const dashboard = await getDashboardSummary(user);
      return NextResponse.json({ dashboard });
    }

    if (view === "reports") {
      const reports = await getReportSnapshot(user);
      return NextResponse.json({ reports });
    }

    const [dashboard, reports] = await Promise.all([
      getDashboardSummary(user),
      getReportSnapshot(user),
    ]);

    return NextResponse.json({ dashboard, reports });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
