import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { projects, weeklyUpdates } from "@/lib/db/schema";
import { submitWeeklyUpdate } from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

export async function GET() {
  try {
    const user = await requireUser();
    const db = getDb();
    const visibleProjects = await db.query.projects.findMany({
      where:
        user.role === "pm"
          ? eq(projects.primaryPmUserId, user.id)
          : eq(projects.archived, false),
      columns: { id: true },
    });

    const updates = visibleProjects.length
      ? await db.query.weeklyUpdates.findMany({
          where: inArray(
            weeklyUpdates.projectId,
            visibleProjects.map((project) => project.id),
          ),
          orderBy: [desc(weeklyUpdates.updateDate), desc(weeklyUpdates.createdAt)],
        })
      : [];

    return NextResponse.json({ updates });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    if (user.role === "viewer") {
      throw new Error("FORBIDDEN");
    }

    const payload = await request.json();
    await submitWeeklyUpdate(payload, user);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
