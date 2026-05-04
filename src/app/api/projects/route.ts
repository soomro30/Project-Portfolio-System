import { NextRequest, NextResponse } from "next/server";

import { requireRole, requireUser } from "@/lib/auth/session";
import {
  createProject,
  getLookupCatalog,
  listLastEmailSentByProject,
  listProjectsForUser,
  listUsers,
} from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

export async function GET() {
  try {
    const user = await requireUser();
    const [projects, lookups, users] = await Promise.all([
      listProjectsForUser(user),
      getLookupCatalog(),
      listUsers(),
    ]);
    const lastEmailSentByProject = await listLastEmailSentByProject(
      projects.map((project) => project.id),
    );
    const enrichedProjects = projects.map((project) => ({
      ...project,
      lastEmailSent: lastEmailSentByProject[project.id] ?? null,
    }));

    return NextResponse.json({ projects: enrichedProjects, lookups, users });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const payload = await request.json();
    const project = await createProject(payload, user);
    return NextResponse.json({ project });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
