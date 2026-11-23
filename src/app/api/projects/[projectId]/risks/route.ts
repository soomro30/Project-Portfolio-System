import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { canAccessProject } from "@/lib/domain/permissions";
import { replaceProjectRisks } from "@/lib/domain/projects";
import { riskListInput } from "@/lib/domain/project-input";
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

    const { risks } = riskListInput.parse(await request.json());
    await replaceProjectRisks(projectId, risks, user);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
