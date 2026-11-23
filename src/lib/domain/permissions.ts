import { and, eq, isNull, or, sql } from "drizzle-orm";

import type { AppSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";

export function projectVisibilityFilter(user: AppSessionUser) {
  if (user.role !== "pm") {
    return eq(projects.archived, false);
  }

  return and(
    eq(projects.archived, false),
    or(
      eq(projects.primaryPmUserId, user.id),
      and(
        isNull(projects.primaryPmUserId),
        eq(projects.pmName, user.name),
        sql`not exists (
          select 1 from ${users} as other_user
          where other_user.name = ${user.name} and other_user.id <> ${user.id} and other_user.active
        )`,
      ),
    ),
  );
}

export async function canAccessProject(user: AppSessionUser, projectId: string) {
  const project = await getDb().query.projects.findFirst({
    where: and(eq(projects.id, projectId), projectVisibilityFilter(user)),
    columns: { id: true },
  });
  return Boolean(project);
}
