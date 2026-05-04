import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getProjectForUser, updateProject } from "@/lib/domain/projects";
import { canAccessProject } from "@/lib/domain/permissions";
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

    return NextResponse.json({ project });
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

    if (!allowed || user.role === "viewer") {
      throw new Error("FORBIDDEN");
    }

    const payload = await request.json();
    const project = await updateProject(projectId, payload, user);
    return NextResponse.json({ project });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
