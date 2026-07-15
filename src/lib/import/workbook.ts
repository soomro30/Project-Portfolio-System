import path from "node:path";

import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

import { getDb } from "@/lib/db";
import {
  lookupValues,
  projects,
  roles,
  users,
  weeklyUpdates,
} from "@/lib/db/schema";
import {
  ensureAdminUser,
  ensureBaseRoles,
  ensureDefaultProjectEmailRecipients,
  seedPmUsers,
} from "@/lib/domain/projects";
import { toDateOnly } from "@/lib/utils/format";

type WorkbookRow = Record<string, unknown>;

const LOOKUP_CATEGORY_MAP: Record<string, string> = {
  Health: "health",
  Stage: "project_stage",
  Priority: "priority",
  "Update Frequency": "update_frequency",
  "Pending With": "pending_with",
};

function toRows(sheet: XLSX.WorkSheet, range?: number) {
  return XLSX.utils.sheet_to_json<WorkbookRow>(sheet, {
    defval: null,
    raw: false,
    range,
  });
}

function getWorkbook(pathname: string) {
  return XLSX.readFile(pathname, { cellDates: true });
}

function parseDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return toDateOnly(value);
  }

  return toDateOnly(String(value));
}

export async function importWorkbookToDatabase(filePath: string) {
  const workbook = getWorkbook(filePath);
  const db = getDb();

  await ensureBaseRoles();
  await ensureAdminUser();

  const portfolioRows = toRows(workbook.Sheets["Portfolio Summary"], 5).filter(
    (row) => row["Project ID"] && row["Project Name"],
  );
  const weeklyRows = toRows(workbook.Sheets["Week Updates"], 2).filter(
    (row) => row["Project ID"] && row["Project Name"],
  );
  const listRows = toRows(workbook.Sheets["Lists"]);

  const pmNames = Array.from(
    new Set(
      portfolioRows
        .map((row) => String(row["PM Name"] ?? "").trim())
        .filter(Boolean),
    ),
  );

  await seedPmUsers(pmNames);

  for (const [header, category] of Object.entries(LOOKUP_CATEGORY_MAP)) {
    const values = listRows
      .map((row) => row[header])
      .filter(Boolean)
      .map((value) => String(value).trim());

    if (!values.length) {
      continue;
    }

    await db.delete(lookupValues).where(eq(lookupValues.category, category));
    await db.insert(lookupValues).values(
      values.map((value, index) => ({
        category,
        value,
        label: value,
        sortOrder: index,
      })),
    );
  }

  const pmUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id));

  const pmMap = new Map(pmUsers.map((user) => [user.name, user]));

  for (const row of portfolioRows) {
    const projectCode = String(row["Project ID"]).trim();
    const pmName = String(row["PM Name"] ?? "").trim();
    const pmUser = pmMap.get(pmName);

    await db
      .insert(projects)
      .values({
        projectCode,
        projectName: String(row["Project Name"] ?? "").trim(),
        projectStage: String(row["Project Stage"] ?? "").trim(),
        pmName,
        health: String(row["Health"] ?? "").trim(),
        priority: String(row["Priority"] ?? "").trim(),
        currentPosition: String(row["Current Status"] ?? row["Current Position"] ?? "").trim() || null,
        keyNextAction: String(row["Key Next Action"] ?? "").trim() || null,
        pendingWith: String(row["Pending With"] ?? "").trim() || null,
        mainBlockerRisk: String(row["Main Blocker / Risk"] ?? "").trim() || null,
        managementUpdate: String(row["Management Update"] ?? "").trim() || null,
        nextMilestone: String(row["Next Milestone"] ?? "").trim() || null,
        nextMilestoneDate: parseDate(row["Next Milestone Date"]),
        lastUpdated: parseDate(row["Last Updated"]),
        updateFrequency: String(row["Update Frequency"] ?? "").trim(),
        primaryPmUserId: pmUser?.id ?? null,
      })
      .onConflictDoUpdate({
        target: projects.projectCode,
        set: {
          projectName: String(row["Project Name"] ?? "").trim(),
          projectStage: String(row["Project Stage"] ?? "").trim(),
          pmName,
          health: String(row["Health"] ?? "").trim(),
          priority: String(row["Priority"] ?? "").trim(),
          currentPosition: String(row["Current Status"] ?? row["Current Position"] ?? "").trim() || null,
          keyNextAction: String(row["Key Next Action"] ?? "").trim() || null,
          pendingWith: String(row["Pending With"] ?? "").trim() || null,
          mainBlockerRisk:
            String(row["Main Blocker / Risk"] ?? "").trim() || null,
          managementUpdate:
            String(row["Management Update"] ?? "").trim() || null,
          nextMilestone: String(row["Next Milestone"] ?? "").trim() || null,
          nextMilestoneDate: parseDate(row["Next Milestone Date"]),
          lastUpdated: parseDate(row["Last Updated"]),
          updateFrequency: String(row["Update Frequency"] ?? "").trim(),
          primaryPmUserId: pmUser?.id ?? null,
        },
      });
  }

  await db.delete(weeklyUpdates);

  for (const row of weeklyRows) {
    const projectCode = String(row["Project ID"] ?? "").trim();
    const project = await db.query.projects.findFirst({
      where: eq(projects.projectCode, projectCode),
    });

    if (!project) {
      continue;
    }

    await db.insert(weeklyUpdates).values({
      projectId: project.id,
      updateDate: parseDate(row["Update Date"]) ?? toDateOnly(new Date())!,
      stage: String(row["Stage"] ?? "").trim(),
      health: String(row["Health"] ?? "").trim(),
      currentPosition: String(row["Current Status"] ?? row["Current Position"] ?? "").trim() || null,
      whatHappened: String(row["What Happened"] ?? "").trim(),
      nextStep: String(row["Next Step"] ?? "").trim(),
      blocker: String(row["Blocker"] ?? "").trim() || null,
      helpNeeded: String(row["Help Needed"] ?? "").trim() || null,
      submittedBy: project.primaryPmUserId ?? null,
    });
  }

  await ensureDefaultProjectEmailRecipients();

  const importedProjects = await db.$count(projects);
  const importedWeeklyUpdates = await db.$count(weeklyUpdates);
  const importedLookupValues = await db.$count(lookupValues);

  return {
    fileName: path.basename(filePath),
    projects: importedProjects,
    weeklyUpdates: importedWeeklyUpdates,
    lookupValues: importedLookupValues,
  };
}
