import { and, eq, or } from "drizzle-orm";

import type { AppSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";

export function isPrivileged(user: AppSessionUser) {
  return user.role === "admin";
}

export async function canAccessProject(user: AppSessionUser, projectId: string) {
  const db = getDb();

  if (user.role === "admin" || user.role === "viewer") {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true },
    });
    return Boolean(project);
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      or(eq(projects.primaryPmUserId, user.id), eq(projects.pmName, user.name)),
    ),
    columns: { id: true },
  });

  return Boolean(project);
}
