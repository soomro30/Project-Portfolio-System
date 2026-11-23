import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getProjectForUser, updateProject, WEEKLY_HISTORY_PAGE_SIZE } from "@/lib/domain/projects";
import { canAccessProject } from "@/lib/domain/permissions";
import { projectInput } from "@/lib/domain/project-input";
import { apiErrorResponse } from "@/lib/utils/api";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser();
    const { projectId } = await context.params;
    const project = await getProjectForUser(user, projectId);

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const weeklyUpdates = project.weeklyUpdates.slice(0, WEEKLY_HISTORY_PAGE_SIZE);
    return NextResponse.json({
      project: {
        ...project,
        weeklyUpdates,
        nextWeeklyBefore: project.weeklyUpdates.length > WEEKLY_HISTORY_PAGE_SIZE
          ? weeklyUpdates.at(-1)?.updateDate ?? null
          : null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser();
    const { projectId } = await context.params;
    const allowed =
      user.role === "admin" ? true : await canAccessProject(user, projectId);

    if (!allowed || user.role === "portfolio_pm" || user.role === "viewer") {
      throw new Error("FORBIDDEN");
    }

    const payload = projectInput.parse(await request.json());
    const project = await updateProject(projectId, payload, user);
    return NextResponse.json({ project });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
