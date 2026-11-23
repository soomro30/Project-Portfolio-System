import { NextRequest, NextResponse } from "next/server";

import { requireRole, requireUser } from "@/lib/auth/session";
import {
  createProject,
  getLookupCatalog,
  listLastEmailSentByProject,
  listProjectsForUser,
  listUsers,
  listWeeklyProjectOptions,
  listWeeklyUpdateSummaries,
} from "@/lib/domain/projects";
import { projectInput } from "@/lib/domain/project-input";
import { apiErrorResponse } from "@/lib/utils/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const view = request.nextUrl.searchParams.get("view");

    if (view === "status") {
      const projects = await listProjectsForUser(user);
      return NextResponse.json({ projects });
    }

    const lookupsQuery = getLookupCatalog();
    const usersQuery = user.role === "admin" && view !== "weekly" ? listUsers() : [];
    if (view === "options") {
      const [lookups, users] = await Promise.all([lookupsQuery, usersQuery]);
      return NextResponse.json({ lookups, users });
    }

    const [projects, lookups, users] = await Promise.all([
      view === "weekly" ? listWeeklyProjectOptions(user) : listProjectsForUser(user),
      lookupsQuery,
      usersQuery,
    ]);
    if (view === "weekly" || view === "admin") {
      return NextResponse.json({ projects, lookups, users });
    }

    const projectIds = projects.map((project) => project.id);
    const [lastEmailSentByProject, updateSummary] = await Promise.all([
      listLastEmailSentByProject(projectIds),
      listWeeklyUpdateSummaries(projectIds),
    ]);
    return NextResponse.json({
      projects: projects.map((project) => ({
        ...project,
        lastEmailSent: lastEmailSentByProject[project.id] ?? null,
      })),
      lookups,
      users,
      updateSummary,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const payload = projectInput.parse(await request.json());
    const project = await createProject(payload, user);
    return NextResponse.json({ project });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
