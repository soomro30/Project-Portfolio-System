import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { canAccessProject } from "@/lib/domain/permissions";
import { replaceProjectRisks } from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser();
    const { projectId } = await context.params;
    const allowed = user.role === "admin" ? true : await canAccessProject(user, projectId);

    if (!allowed || user.role === "portfolio_pm" || user.role === "viewer") {
      throw new Error("FORBIDDEN");
    }

    const { risks } = (await request.json()) as { risks: unknown[] };
    await replaceProjectRisks(projectId, risks as never[], user);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
