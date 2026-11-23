import path from "node:path";

import { eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";

import { getDb } from "@/lib/db";
import {
  auditLogs,
  lookupValues,
  projectEmailRecipients,
  projects,
  weeklyUpdates,
} from "@/lib/db/schema";
import {
  ensureBaseRoles,
  seedPmUsers,
} from "@/lib/domain/projects";
import { DEFAULT_PROJECT_EMAIL_RECIPIENT } from "@/lib/email/defaults";
import { RequestError } from "@/lib/utils/api";
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

export async function importWorkbookToDatabase(filePath: string, actorUserId?: string) {
  const workbook = getWorkbook(filePath);
  for (const sheet of ["Portfolio Summary", "Week Updates", "Lists"]) {
    if (!workbook.Sheets[sheet]) throw new RequestError(`Workbook is missing the "${sheet}" sheet.`);
  }

  const portfolioRows = toRows(workbook.Sheets["Portfolio Summary"], 5)
    .filter((row) => row["Project ID"] && row["Project Name"]);
  const weeklyRows = toRows(workbook.Sheets["Week Updates"], 2)
    .filter((row) => row["Project ID"] && row["Project Name"]);
  const listRows = toRows(workbook.Sheets["Lists"]);
  if (!portfolioRows.length) throw new RequestError("The workbook contains no project records.");

  const projectCodes = new Set<string>();
  for (const row of portfolioRows) {
    const code = String(row["Project ID"]).trim();
    if (!code || projectCodes.has(code)) throw new RequestError(`Invalid or duplicate project code: ${code}`);
    projectCodes.add(code);
  }

  const historyKeys = new Set<string>();
  const history = weeklyRows.map((row) => {
    const code = String(row["Project ID"]).trim();
    const updateDate = parseDate(row["Update Date"]);
    if (!projectCodes.has(code) || !updateDate) {
      throw new RequestError(`Weekly history has an unknown project or invalid date for ${code}.`);
    }
    const key = `${code}/${updateDate}`;
    if (historyKeys.has(key)) throw new RequestError(`Duplicate workbook update for ${key}.`);
    historyKeys.add(key);
    return { row, code, updateDate };
  });

  const pmNames = [...new Set(portfolioRows.map((row) => String(row["PM Name"] ?? "").trim()).filter(Boolean))];
  return getDb().transaction(async (db) => {
    await db.execute(sql`select pg_advisory_xact_lock(173204, 1)`);
    await ensureBaseRoles(db);
    const pmAssignments = await seedPmUsers(pmNames, db);

    for (const [header, category] of Object.entries(LOOKUP_CATEGORY_MAP)) {
      const values = [...new Set(listRows.map((row) => String(row[header] ?? "").trim()).filter(Boolean))];
      if (!values.length) continue;
      const existing = await db.select({ value: lookupValues.value }).from(lookupValues)
        .where(eq(lookupValues.category, category));
      const existingValues = new Set(existing.map(({ value }) => value));
      const missing = values.filter((value) => !existingValues.has(value));
      if (missing.length) {
        await db.insert(lookupValues).values(missing.map((value, index) => ({
          category, value, label: value, sortOrder: existing.length + index,
        })));
      }
    }

    const newProjects = await db.insert(projects).values(portfolioRows.map((row) => ({
      projectCode: String(row["Project ID"]).trim(),
      projectName: String(row["Project Name"]).trim(),
      projectStage: String(row["Project Stage"] ?? "").trim(),
      pmName: String(row["PM Name"] ?? "").trim(),
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
      primaryPmUserId: pmAssignments.get(String(row["PM Name"] ?? "").trim()) ?? null,
    }))).onConflictDoNothing({ target: projects.projectCode }).returning({ id: projects.id });

    if (newProjects.length) {
      await db.insert(projectEmailRecipients).values(
        newProjects.map(({ id }) => ({ projectId: id, ...DEFAULT_PROJECT_EMAIL_RECIPIENT })),
      );
    }

    const projectRows = await db.select({ id: projects.id, code: projects.projectCode, pmId: projects.primaryPmUserId }).from(projects);
    const projectMap = new Map(projectRows.map((project) => [project.code, project]));
    let insertedUpdates = 0;
    if (history.length) {
      const updates = await db.insert(weeklyUpdates).values(history.map(({ row, code, updateDate }) => {
        const project = projectMap.get(code)!;
        return {
          projectId: project.id,
          updateDate,
          stage: String(row["Stage"] ?? "").trim(),
          health: String(row["Health"] ?? "").trim(),
          currentPosition: String(row["Current Status"] ?? row["Current Position"] ?? "").trim() || null,
          whatHappened: String(row["What Happened"] ?? "").trim(),
          nextStep: String(row["Next Step"] ?? "").trim(),
          blocker: String(row["Blocker"] ?? "").trim() || null,
          helpNeeded: String(row["Help Needed"] ?? "").trim() || null,
          submittedBy: project.pmId,
        };
      })).onConflictDoNothing({ target: [weeklyUpdates.projectId, weeklyUpdates.updateDate] })
        .returning({ id: weeklyUpdates.id });
      insertedUpdates = updates.length;
    }

    const summary = {
      fileName: path.basename(filePath),
      projects: projectRows.length,
      weeklyUpdates: await db.$count(weeklyUpdates),
      lookupValues: await db.$count(lookupValues),
      insertedProjects: newProjects.length,
      insertedUpdates,
    };
    if (actorUserId) {
      await db.insert(auditLogs).values({
        actorUserId,
        entityType: "system",
        entityId: "workbook-import",
        action: "import.workbook",
        metadata: summary,
      });
    }
    return summary;
  });
}
