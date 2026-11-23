import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  gte,
  isNotNull,
  lt,
  sql,
} from "drizzle-orm";

import type { AppSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  auditLogs,
  emailRuns,
  lookupValues,
  projectEmailRecipients,
  projectMilestones,
  projectRisks,
  projects,
  roles,
  users,
  weeklyUpdates,
} from "@/lib/db/schema";
import { projectVisibilityFilter } from "@/lib/domain/permissions";
import { buildMasterCurrentPositionFromUpdates } from "@/lib/domain/project-master-sync";
import { applyWeeklyUpdateToProject, deriveNextMilestone, getLateDays, tracksReportingCadence } from "@/lib/domain/project-sync";
import { DEFAULT_PROJECT_EMAIL_RECIPIENT } from "@/lib/email/defaults";
import { getEnv } from "@/lib/env";
import { importWorkbookToDatabase } from "@/lib/import/workbook";
import { sendProjectStatusEmail } from "@/lib/email/service";
import { RequestError } from "@/lib/utils/api";
import { isMeaningfulText, slugifyName, toDateOnly } from "@/lib/utils/format";

export type LookupCatalog = Record<string, string[]>;

export async function ensureBaseRoles(db: ReturnType<typeof getDb> | ProjectTransaction = getDb()) {
  await db
    .insert(roles)
    .values([
      { name: "admin", label: "Administrator" },
      { name: "pm", label: "Project Manager" },
      { name: "portfolio_pm", label: "Portfolio Project Manager" },
      { name: "viewer", label: "Viewer" },
    ])
    .onConflictDoNothing();
}

export async function ensureAdminUser() {
  await ensureBaseRoles();

  const db = getDb();
  const env = getEnv();
  const adminRole = await db.query.roles.findFirst({
    where: eq(roles.name, "admin"),
  });

  if (!adminRole) {
    throw new Error("Admin role missing");
  }

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, env.DEFAULT_ADMIN_EMAIL.toLowerCase()),
  });

  if (existingAdmin) {
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(env.DEFAULT_ADMIN_PASSWORD, 10);
  const inserted = await db
    .insert(users)
    .values({
      name: "IMKAN Admin",
      email: env.DEFAULT_ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      roleId: adminRole.id,
      active: true,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  return inserted[0] ?? db.query.users.findFirst({
    where: eq(users.email, env.DEFAULT_ADMIN_EMAIL.toLowerCase()),
  });
}

export async function getLookupCatalog() {
  const db = getDb();
  const values = await db
    .select()
    .from(lookupValues)
    .where(eq(lookupValues.isActive, true))
    .orderBy(asc(lookupValues.category), asc(lookupValues.sortOrder), asc(lookupValues.label));

  return values.reduce<LookupCatalog>((catalog, item) => {
    const key = item.category;
    catalog[key] ??= [];
    catalog[key].push(item.value);
    return catalog;
  }, {});
}

export async function listUsers() {
  const db = getDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      role: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(asc(users.name));
}

export async function listProjectsForUser(user: AppSessionUser) {
  return getDb().query.projects.findMany({
    where: projectVisibilityFilter(user),
    orderBy: [asc(projects.projectCode)],
  });
}

const orderedMilestones = {
  orderBy: [asc(projectMilestones.sortOrder), asc(projectMilestones.dueDate)],
};

export async function listWeeklyProjectOptions(user: AppSessionUser) {
  return getDb().query.projects.findMany({
    where: projectVisibilityFilter(user),
    orderBy: [asc(projects.projectCode)],
    columns: {
      id: true, projectCode: true, projectName: true, projectStage: true, health: true,
      progressPercent: true, managementUpdate: true, pendingWith: true,
      nextMilestone: true, nextMilestoneDate: true,
    },
    with: {
      milestones: {
        ...orderedMilestones,
        columns: { id: true, title: true, dueDate: true, status: true, notes: true, completedAt: true },
      },
    },
  });
}

export async function listWeeklyUpdateSummaries(projectIds: string[]) {
  if (!projectIds.length) return {};

  const rows = await getDb().selectDistinctOn([weeklyUpdates.projectId], {
    projectId: weeklyUpdates.projectId,
    latestUpdateDate: weeklyUpdates.updateDate,
    latestStage: weeklyUpdates.stage,
    count: sql<number>`count(*) over (partition by ${weeklyUpdates.projectId})`.mapWith(Number),
  }).from(weeklyUpdates).where(inArray(weeklyUpdates.projectId, projectIds))
    .orderBy(weeklyUpdates.projectId, desc(weeklyUpdates.updateDate));

  return Object.fromEntries(rows.map(({ projectId, ...summary }) => [projectId, summary]));
}

export const WEEKLY_HISTORY_PAGE_SIZE = 25;

export async function listWeeklyHistory(user: AppSessionUser, projectId?: string, before?: string) {
  const db = getDb();
  if (projectId) {
    const project = await db.query.projects.findFirst({
      columns: { id: true },
      where: and(eq(projects.id, projectId), projectVisibilityFilter(user)),
    });
    if (!project) throw new RequestError("Project not found.", 404);
  }

  const visibleProjectIds = db.select({ id: projects.id }).from(projects)
    .where(projectVisibilityFilter(user));
  const rows = await db.query.weeklyUpdates.findMany({
    where: and(
      inArray(weeklyUpdates.projectId, visibleProjectIds),
      projectId ? eq(weeklyUpdates.projectId, projectId) : undefined,
      before ? lt(weeklyUpdates.updateDate, before) : undefined,
    ),
    orderBy: [desc(weeklyUpdates.updateDate), desc(weeklyUpdates.createdAt)],
    limit: WEEKLY_HISTORY_PAGE_SIZE + 1,
  });

  return {
    updates: rows.slice(0, WEEKLY_HISTORY_PAGE_SIZE),
    nextBefore: projectId && rows.length > WEEKLY_HISTORY_PAGE_SIZE
      ? rows[WEEKLY_HISTORY_PAGE_SIZE - 1].updateDate
      : null,
  };
}

export async function getProjectsForReports(user: AppSessionUser, projectIds: string[]) {
  if (!projectIds.length) return [];

  return getDb().query.projects.findMany({
    where: and(projectVisibilityFilter(user), inArray(projects.id, projectIds)),
    orderBy: [asc(projects.projectCode)],
    with: {
      milestones: orderedMilestones,
      risks: { orderBy: [asc(projectRisks.sortOrder), asc(projectRisks.targetDate)] },
      weeklyUpdates: { orderBy: [desc(weeklyUpdates.updateDate)], limit: 1 },
    },
  });
}

export async function listLastEmailSentByProject(projectIds: string[]) {
  if (!projectIds.length) {
    return {};
  }

  const db = getDb();
  const rows = await db
    .select({
      projectId: emailRuns.projectId,
      lastEmailSent: sql<string | null>`max(${emailRuns.sentAt})`,
    })
    .from(emailRuns)
    .where(
      and(
        inArray(emailRuns.projectId, projectIds),
        eq(emailRuns.status, "sent"),
        isNotNull(emailRuns.sentAt),
      ),
    )
    .groupBy(emailRuns.projectId);

  return rows.reduce<Record<string, string | null>>((acc, row) => {
    if (row.projectId) {
      acc[row.projectId] = row.lastEmailSent;
    }
    return acc;
  }, {});
}

export async function getProjectForUser(user: AppSessionUser, projectId: string) {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), projectVisibilityFilter(user)),
    with: {
      milestones: {
        orderBy: [asc(projectMilestones.sortOrder), asc(projectMilestones.dueDate)],
      },
      risks: {
        orderBy: [asc(projectRisks.sortOrder), asc(projectRisks.targetDate)],
      },
      recipients: {
        orderBy: [asc(projectEmailRecipients.recipientType), asc(projectEmailRecipients.email)],
      },
      weeklyUpdates: {
        orderBy: [desc(weeklyUpdates.updateDate)],
        limit: WEEKLY_HISTORY_PAGE_SIZE + 1,
      },
      primaryPmUser: { columns: { id: true, name: true, email: true } },
    },
  });

  return project ?? null;
}

type ProjectInput = {
  projectCode: string;
  projectName: string;
  projectStage: string;
  pmName: string;
  projectSponsor?: string | null;
  projectDescription?: string | null;
  progressPercent?: number | string | null;
  health: string;
  priority: string;
  currentPosition?: string | null;
  keyNextAction?: string | null;
  pendingWith?: string | null;
  mainBlockerRisk?: string | null;
  managementUpdate?: string | null;
  nextMilestone?: string | null;
  nextMilestoneDate?: string | null;
  lastUpdated?: string | null;
  updateFrequency: string;
  startDate?: string | null;
  endDate?: string | null;
  actualEndDate?: string | null;
  budgetCurrency?: string | null;
  contractValue?: string | null;
  actualSpendToDate?: string | null;
  primaryPmUserId?: string | null;
  weeklyEmailEnabled?: boolean;
  monthlyEmailEnabled?: boolean;
  recipients?: Array<{ email: string; recipientType: "to" | "cc"; name?: string | null }>;
};

type ProjectRecipientInput = NonNullable<ProjectInput["recipients"]>[number];

function withDefaultProjectRecipient(recipients: ProjectInput["recipients"] = []) {
  const defaultEmail = DEFAULT_PROJECT_EMAIL_RECIPIENT.email.toLowerCase();
  const cleaned = recipients
    .map<ProjectRecipientInput>((recipient) => ({
      email: recipient.email.trim(),
      recipientType: recipient.recipientType,
      name: normalizeOptionalText(recipient.name),
    }))
    .filter((recipient) => recipient.email)
    .filter(
      (recipient) =>
        recipient.recipientType === "to" ||
        recipient.email.toLowerCase() !== defaultEmail,
    );

  const hasDefaultTo = cleaned.some(
    (recipient) =>
      recipient.recipientType === "to" &&
      recipient.email.toLowerCase() === defaultEmail,
  );

  if (!hasDefaultTo) {
    cleaned.unshift(DEFAULT_PROJECT_EMAIL_RECIPIENT);
  }

  return cleaned;
}

export async function ensureDefaultProjectEmailRecipients() {
  const db = getDb();
  const projectRows = await db.query.projects.findMany({
    columns: { id: true },
    with: {
      recipients: {
        columns: { email: true, recipientType: true },
      },
    },
  });

  const defaultEmail = DEFAULT_PROJECT_EMAIL_RECIPIENT.email.toLowerCase();
  const missingProjectIds = projectRows
    .filter(
      (project) =>
        !project.recipients.some(
          (recipient) =>
            recipient.recipientType === "to" &&
            recipient.email.toLowerCase() === defaultEmail,
        ),
    )
    .map((project) => project.id);

  if (!missingProjectIds.length) {
    return 0;
  }

  await db.insert(projectEmailRecipients).values(
    missingProjectIds.map((projectId) => ({
      projectId,
      ...DEFAULT_PROJECT_EMAIL_RECIPIENT,
    })),
  );

  return missingProjectIds.length;
}

function normalizeProgressPercent(value?: number | string | null) {
  if (value === "" || value == null) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalDate(value?: string | null) {
  return normalizeOptionalText(value);
}

function normalizeOptionalNumeric(value?: string | null) {
  return normalizeOptionalText(value);
}

async function recordAuditLog(
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  projectId?: string | null,
  metadata?: Record<string, unknown>,
  db: Pick<ReturnType<typeof getDb>, "insert"> = getDb(),
) {
  await db.insert(auditLogs).values({
    actorUserId,
    projectId: projectId ?? null,
    entityType,
    entityId,
    action,
    metadata,
  });
}

export async function createProject(input: ProjectInput, actor: AppSessionUser) {
  return getDb().transaction(async (db) => {
    const inserted = await db
      .insert(projects)
      .values({
        projectCode: input.projectCode,
        projectName: input.projectName,
        projectStage: input.projectStage,
        pmName: input.pmName,
        projectSponsor: normalizeOptionalText(input.projectSponsor),
        projectDescription: normalizeOptionalText(input.projectDescription),
        progressPercent: normalizeProgressPercent(input.progressPercent),
        health: input.health,
        priority: input.priority,
        currentPosition: normalizeOptionalText(input.currentPosition),
        keyNextAction: normalizeOptionalText(input.keyNextAction),
        pendingWith: normalizeOptionalText(input.pendingWith),
        mainBlockerRisk: normalizeOptionalText(input.mainBlockerRisk),
        managementUpdate: normalizeOptionalText(input.managementUpdate),
        nextMilestone: normalizeOptionalText(input.nextMilestone),
        nextMilestoneDate: normalizeOptionalDate(input.nextMilestoneDate),
        lastUpdated: normalizeOptionalDate(input.lastUpdated),
        updateFrequency: input.updateFrequency,
        startDate: normalizeOptionalDate(input.startDate),
        endDate: normalizeOptionalDate(input.endDate),
        actualEndDate: normalizeOptionalDate(input.actualEndDate),
        budgetCurrency: normalizeOptionalText(input.budgetCurrency) ?? "AED",
        contractValue: normalizeOptionalNumeric(input.contractValue),
        actualSpendToDate: normalizeOptionalNumeric(input.actualSpendToDate),
        primaryPmUserId: normalizeOptionalText(input.primaryPmUserId),
        weeklyEmailEnabled: input.weeklyEmailEnabled ?? true,
        monthlyEmailEnabled: input.monthlyEmailEnabled ?? true,
      })
      .returning();

    const recipients = withDefaultProjectRecipient(input.recipients);

    if (recipients.length) {
      await db.insert(projectEmailRecipients).values(
        recipients.map((recipient) => ({
          projectId: inserted[0].id,
          email: recipient.email,
          recipientType: recipient.recipientType,
          name: recipient.name ?? null,
        })),
      );
    }

    await recordAuditLog(actor.id, "project.create", "project", inserted[0].id, inserted[0].id, {
      projectCode: input.projectCode,
    }, db);

    return inserted[0];
  });
}

export async function updateProject(
  projectId: string,
  input: ProjectInput,
  actor: AppSessionUser,
) {
  return getDb().transaction(async (db) => {

    const [existing] = await db.select().from(projects).where(and(eq(projects.id, projectId), projectVisibilityFilter(actor))).for("update");
    if (!existing) throw new RequestError("Project not found.", 404);

    const updated = await db
      .update(projects)
      .set({
        projectCode: actor.role === "admin" ? input.projectCode : existing.projectCode,
        projectName: input.projectName,
        projectStage: input.projectStage,
        pmName: actor.role === "admin" ? input.pmName : existing.pmName,
        projectSponsor: normalizeOptionalText(input.projectSponsor),
        projectDescription: normalizeOptionalText(input.projectDescription),
        progressPercent: normalizeProgressPercent(input.progressPercent),
        health: input.health,
        priority: input.priority,
        currentPosition: normalizeOptionalText(input.currentPosition),
        keyNextAction: normalizeOptionalText(input.keyNextAction),
        pendingWith: normalizeOptionalText(input.pendingWith),
        mainBlockerRisk: normalizeOptionalText(input.mainBlockerRisk),
        managementUpdate: normalizeOptionalText(input.managementUpdate),
        nextMilestone: normalizeOptionalText(input.nextMilestone),
        nextMilestoneDate: normalizeOptionalDate(input.nextMilestoneDate),
        lastUpdated: normalizeOptionalDate(input.lastUpdated),
        updateFrequency: input.updateFrequency,
        startDate: normalizeOptionalDate(input.startDate),
        endDate: normalizeOptionalDate(input.endDate),
        actualEndDate: normalizeOptionalDate(input.actualEndDate),
        budgetCurrency: normalizeOptionalText(input.budgetCurrency) ?? "AED",
        contractValue: normalizeOptionalNumeric(input.contractValue),
        actualSpendToDate: normalizeOptionalNumeric(input.actualSpendToDate),
        primaryPmUserId: actor.role === "admin" ? normalizeOptionalText(input.primaryPmUserId) : existing.primaryPmUserId,
        weeklyEmailEnabled: actor.role === "admin" ? input.weeklyEmailEnabled ?? existing.weeklyEmailEnabled : existing.weeklyEmailEnabled,
        monthlyEmailEnabled: actor.role === "admin" ? input.monthlyEmailEnabled ?? existing.monthlyEmailEnabled : existing.monthlyEmailEnabled,
      })
      .where(eq(projects.id, projectId))
      .returning();

    if (actor.role === "admin" && input.recipients) {
      await db.delete(projectEmailRecipients).where(eq(projectEmailRecipients.projectId, projectId));
      const recipients = withDefaultProjectRecipient(input.recipients);
      if (recipients.length) {
        await db.insert(projectEmailRecipients).values(
          recipients.map((recipient) => ({
            projectId,
            email: recipient.email,
            recipientType: recipient.recipientType,
            name: recipient.name ?? null,
          })),
        );
      }
    }

    await recordAuditLog(actor.id, "project.update", "project", projectId, projectId, {
      projectCode: actor.role === "admin" ? input.projectCode : existing.projectCode,
    }, db);

    return updated[0];
  });
}

type MilestoneInput = {
  id?: string;
  title: string;
  dueDate?: string | null;
  status: string;
  owner?: string | null;
  notes?: string | null;
  sortOrder: number;
};

export async function replaceProjectMilestones(
  projectId: string,
  milestones: MilestoneInput[],
  actor: AppSessionUser,
) {
  return getDb().transaction(async (db) => {
    const [project] = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, projectId), projectVisibilityFilter(actor))).for("update");
    if (!project) throw new RequestError("Project not found.", 404);

    const existing = await db.query.projectMilestones.findMany({
      where: eq(projectMilestones.projectId, projectId),
      columns: { id: true, status: true, completedAt: true },
    });
    const keepIds = milestones.filter((item) => item.id).map((item) => item.id as string);

    const existingById = new Map(existing.map((row) => [row.id, row]));
    if (new Set(keepIds).size !== keepIds.length || keepIds.some((id) => !existingById.has(id))) {
      throw new RequestError("The submitted list contains invalid or duplicate records.");
    }
    const retainedIds = new Set(keepIds);
    {
      const deleteIds = existing
        .map((item) => item.id)
        .filter((id) => !retainedIds.has(id));

      if (deleteIds.length) {
        await db
          .delete(projectMilestones)
          .where(
            and(
              eq(projectMilestones.projectId, projectId),
              inArray(projectMilestones.id, deleteIds),
            ),
          );
      }
    }

    for (const milestone of milestones) {
      if (milestone.id) {
        const previous = existingById.get(milestone.id)!;

        await db
          .update(projectMilestones)
          .set({
            title: milestone.title,
            dueDate: normalizeOptionalDate(milestone.dueDate),
            status: milestone.status,
            owner: milestone.owner ?? null,
            notes: milestone.notes ?? null,
            sortOrder: milestone.sortOrder,
            completedAt: milestone.status === "completed"
              ? previous.status === "completed" ? previous.completedAt : new Date()
              : null,
          })
          .where(and(eq(projectMilestones.projectId, projectId), eq(projectMilestones.id, milestone.id)));
      } else {
        await db.insert(projectMilestones).values({
          projectId,
          title: milestone.title,
          dueDate: normalizeOptionalDate(milestone.dueDate),
          status: milestone.status,
          owner: milestone.owner ?? null,
          notes: milestone.notes ?? null,
          sortOrder: milestone.sortOrder,
          completedAt: milestone.status === "completed" ? new Date() : null,
        });
      }
    }

    await resequenceProjectMilestones(projectId, db);

    const refreshedMilestones = await db.query.projectMilestones.findMany({
      where: eq(projectMilestones.projectId, projectId),
    });

    const nextMilestone = deriveNextMilestone(refreshedMilestones);

    await db
      .update(projects)
      .set({
        nextMilestone: nextMilestone.nextMilestone,
        nextMilestoneDate: nextMilestone.nextMilestoneDate,
      })
      .where(eq(projects.id, projectId));

    await recordAuditLog(actor.id, "milestones.replace", "project", projectId, projectId, {
      count: milestones.length,
    }, db);
  });
}

type RiskInput = {
  id?: string;
  title: string;
  description: string;
  owner?: string | null;
  mitigationPlan?: string | null;
  status: string;
  severity: string;
  targetDate?: string | null;
  sortOrder: number;
};

export async function replaceProjectRisks(
  projectId: string,
  risks: RiskInput[],
  actor: AppSessionUser,
) {
  return getDb().transaction(async (db) => {
    const [project] = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, projectId), projectVisibilityFilter(actor))).for("update");
    if (!project) throw new RequestError("Project not found.", 404);

    const existing = await db.query.projectRisks.findMany({
      where: eq(projectRisks.projectId, projectId),
      columns: { id: true },
    });
    const keepIds = risks.filter((item) => item.id).map((item) => item.id as string);

    const existingById = new Map(existing.map((row) => [row.id, row]));
    if (new Set(keepIds).size !== keepIds.length || keepIds.some((id) => !existingById.has(id))) {
      throw new RequestError("The submitted list contains invalid or duplicate records.");
    }
    const retainedIds = new Set(keepIds);
    {
      const deleteIds = existing
        .map((item) => item.id)
        .filter((id) => !retainedIds.has(id));

      if (deleteIds.length) {
        await db
          .delete(projectRisks)
          .where(and(eq(projectRisks.projectId, projectId), inArray(projectRisks.id, deleteIds)));
      }
    }

    for (const risk of risks) {
      if (risk.id) {

        await db
          .update(projectRisks)
          .set({
            title: risk.title,
            description: risk.description,
            owner: risk.owner ?? null,
            mitigationPlan: risk.mitigationPlan ?? null,
            status: risk.status,
            severity: risk.severity,
            targetDate: normalizeOptionalDate(risk.targetDate),
            sortOrder: risk.sortOrder,
          })
          .where(and(eq(projectRisks.projectId, projectId), eq(projectRisks.id, risk.id)));
      } else {
        await db.insert(projectRisks).values({
          projectId,
          title: risk.title,
          description: risk.description,
          owner: risk.owner ?? null,
          mitigationPlan: risk.mitigationPlan ?? null,
          status: risk.status,
          severity: risk.severity,
          targetDate: normalizeOptionalDate(risk.targetDate),
          sortOrder: risk.sortOrder,
        });
      }
    }

    await recordAuditLog(actor.id, "risks.replace", "project", projectId, projectId, {
      count: risks.length,
    }, db);
  });
}

type WeeklyUpdateInput = {
  projectId: string;
  updateDate: string;
  stage: string;
  health: string;
  progressPercent?: number | null;
  managementUpdate?: string | null;
  currentPosition?: string | null;
  whatHappened: string;
  nextStep: string;
  blocker?: string | null;
  pendingWith?: string | null;
  nextMilestone?: string | null;
  nextMilestoneDate?: string | null;
  helpNeeded?: string | null;
  milestoneReviews?: MilestoneReviewInput[];
};

const WEEKLY_UPDATE_RISK_TITLE = "Weekly Update Risk";

type MilestoneReviewInput = {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  completedAt?: string | null;
  notes?: string | null;
};

const MILESTONE_REVIEW_STATUSES = new Set([
  "planned",
  "in_progress",
  "at_risk",
  "completed",
]);

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeMilestoneDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  return toDateOnly(value);
}

function sortMilestoneRecords<
  T extends { title: string; dueDate?: string | Date | null; sortOrder: number },
>(milestones: T[]) {
  return milestones.slice().sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    const leftDue = normalizeMilestoneDate(left.dueDate);
    const rightDue = normalizeMilestoneDate(right.dueDate);

    if (leftDue && rightDue && leftDue !== rightDue) {
      return leftDue.localeCompare(rightDue);
    }

    if (leftDue && !rightDue) {
      return -1;
    }

    if (!leftDue && rightDue) {
      return 1;
    }

    return left.title.localeCompare(right.title);
  });
}

type ProjectTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function resequenceProjectMilestones(projectId: string, db: ProjectTransaction) {
  const milestones = await db.query.projectMilestones.findMany({
    where: eq(projectMilestones.projectId, projectId),
  });

  for (const [index, milestone] of sortMilestoneRecords(milestones).entries()) {
    const nextSortOrder = index + 1;

    if (milestone.sortOrder !== nextSortOrder) {
      await db
        .update(projectMilestones)
        .set({ sortOrder: nextSortOrder, updatedAt: new Date() })
        .where(eq(projectMilestones.id, milestone.id));
    }
  }
}

function weeklyRiskSeverity(health: string) {
  if (health === "Red") {
    return "high";
  }

  if (health === "Amber") {
    return "medium";
  }

  return "low";
}

function normalizeMilestoneReviewStatus(status: string) {
  return MILESTONE_REVIEW_STATUSES.has(status) ? status : "planned";
}

export async function submitWeeklyUpdate(
  input: WeeklyUpdateInput,
  actor: AppSessionUser,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [locked] = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, input.projectId), projectVisibilityFilter(actor))).for("update");
    if (!locked) throw new RequestError("Project not found.", 404);

    const project = await tx.query.projects.findFirst({
      where: eq(projects.id, locked.id),
      with: {
        milestones: true,
        risks: true,
      },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const reviews = new Map((input.milestoneReviews ?? []).map((review) => [review.id, review]));
    const milestonesById = new Map(project.milestones.map((milestone) => [milestone.id, milestone]));
    if (reviews.size !== (input.milestoneReviews?.length ?? 0) ||
        Array.from(reviews.keys()).some((id) => !milestonesById.has(id))) {
      throw new RequestError("Milestone reviews must refer to distinct milestones on this project.");
    }
    const reviewedMilestones = project.milestones.map((milestone) => {
      const review = reviews.get(milestone.id);
      return review ? {
        ...milestone,
        title: review.title.trim(),
        dueDate: normalizeOptionalDate(review.dueDate),
        status: normalizeMilestoneReviewStatus(review.status),
      } : milestone;
    });
    const matchingMilestone = reviewedMilestones.find((milestone) =>
      normalizeComparableText(milestone.title) === normalizeComparableText(input.nextMilestone ?? ""));
    const reviewedNextMilestone = matchingMilestone ? reviews.get(matchingMilestone.id) : undefined;
    const snapshotInput = reviewedNextMilestone && matchingMilestone
      ? { ...input, nextMilestoneDate: matchingMilestone.dueDate }
      : input;
    const snapshot = applyWeeklyUpdateToProject(project, snapshotInput, reviewedMilestones);
    const blocker = normalizeOptionalText(input.blocker);
    const managementUpdate = normalizeOptionalText(input.managementUpdate);
    const currentPosition = normalizeOptionalText(input.currentPosition);
    const pendingWith = normalizeOptionalText(input.pendingWith);
    const nextMilestoneTitle = normalizeOptionalText(input.nextMilestone);
    const nextMilestoneDate = normalizeOptionalDate(input.nextMilestoneDate);
    const helpNeeded = normalizeOptionalText(input.helpNeeded);
    const existingWeeklyRisk = project.risks.find(
      (risk) => normalizeComparableText(risk.title) === normalizeComparableText(WEEKLY_UPDATE_RISK_TITLE),
    );
    const existingNextMilestone = nextMilestoneTitle
      ? project.milestones.find((milestone) => milestone.status !== "completed" &&
          normalizeComparableText(milestone.title) === normalizeComparableText(nextMilestoneTitle))
      : null;

    const latest = await tx.query.weeklyUpdates.findFirst({
      where: eq(weeklyUpdates.projectId, input.projectId),
      columns: { updateDate: true },
      orderBy: [desc(weeklyUpdates.updateDate)],
    });
    const isHistorical = [project.lastUpdated, latest?.updateDate].some((date) => date && date > input.updateDate);
    const recordedProgress = isHistorical && input.progressPercent == null && input.stage.trim().toLowerCase() !== "completed"
      ? null
      : snapshot.progressPercent;
    await tx
      .insert(weeklyUpdates)
      .values({
        projectId: input.projectId,
        updateDate: input.updateDate,
        stage: input.stage,
        health: input.health,
        progressPercent: recordedProgress,
        managementUpdate: managementUpdate ?? snapshot.managementUpdate,
        currentPosition,
        whatHappened: input.whatHappened,
        nextStep: input.nextStep,
        blocker,
        pendingWith,
        nextMilestone: nextMilestoneTitle,
        nextMilestoneDate,
        helpNeeded,
        submittedBy: actor.id,
      })
      .onConflictDoUpdate({
        target: [weeklyUpdates.projectId, weeklyUpdates.updateDate],
        set: {
          stage: input.stage,
          health: input.health,
          progressPercent: recordedProgress,
          managementUpdate: managementUpdate ?? snapshot.managementUpdate,
          currentPosition,
          whatHappened: input.whatHappened,
          nextStep: input.nextStep,
          blocker,
          pendingWith,
          nextMilestone: nextMilestoneTitle,
          nextMilestoneDate,
          helpNeeded,
          submittedBy: actor.id,
        },
      });

    if (isHistorical) {
      await recordAuditLog(actor.id, "weekly_update.submit", "project", input.projectId, input.projectId, {
        updateDate: input.updateDate, syncedProjectMaster: false,
      }, tx);
      return { syncedProjectMaster: false };
    }

    await tx
      .update(projects)
      .set({
        projectStage: snapshot.projectStage,
        health: snapshot.health,
        progressPercent: snapshot.progressPercent,
        managementUpdate: snapshot.managementUpdate,
        currentPosition: snapshot.currentPosition,
        keyNextAction: snapshot.keyNextAction,
        pendingWith: snapshot.pendingWith,
        mainBlockerRisk: snapshot.mainBlockerRisk,
        lastUpdated: snapshot.lastUpdated,
        actualEndDate: snapshot.actualEndDate,
        nextMilestone: snapshot.nextMilestone,
        nextMilestoneDate: snapshot.nextMilestoneDate,
      })
      .where(eq(projects.id, input.projectId));

    if (isMeaningfulText(blocker)) {
      const riskDescription = blocker as string;
      if (existingWeeklyRisk) {
        await tx
          .update(projectRisks)
          .set({
            description: riskDescription,
            owner: pendingWith,
            mitigationPlan: helpNeeded ?? input.nextStep,
            status: "open",
            severity: weeklyRiskSeverity(input.health),
              updatedAt: new Date(),
          })
          .where(eq(projectRisks.id, existingWeeklyRisk.id));
      } else {
        await tx.insert(projectRisks).values({
          projectId: input.projectId,
          title: WEEKLY_UPDATE_RISK_TITLE,
          description: riskDescription,
          owner: pendingWith,
          mitigationPlan: helpNeeded ?? input.nextStep,
          status: "open",
          severity: weeklyRiskSeverity(input.health),
          sortOrder: project.risks.length + 1,
        });
      }
    } else if (existingWeeklyRisk && existingWeeklyRisk.status !== "closed") {
      await tx
        .update(projectRisks)
        .set({
          status: "closed",
          mitigationPlan: helpNeeded ?? "No active blocker reported in the latest weekly update.",
          updatedAt: new Date(),
        })
        .where(eq(projectRisks.id, existingWeeklyRisk.id));
    }

    const updateMilestoneDueDate = input.nextMilestoneDate !== undefined &&
      existingNextMilestone && !reviews.has(existingNextMilestone.id);
    if (updateMilestoneDueDate) {
      await tx
        .update(projectMilestones)
        .set({
          dueDate: nextMilestoneDate,
          updatedAt: new Date(),
        })
        .where(eq(projectMilestones.id, existingNextMilestone.id));
    }

    for (const review of reviews.values()) {
      const existing = milestonesById.get(review.id);
      const status = normalizeMilestoneReviewStatus(review.status);
      const reviewDate = normalizeOptionalDate(review.completedAt);
      const previousDate = existing?.completedAt ?? null;
      const completionDate = reviewDate && reviewDate !== toDateOnly(previousDate)
        ? new Date(`${reviewDate}T00:00:00Z`)
        : existing?.status === "completed" ? previousDate : new Date(`${input.updateDate}T00:00:00Z`);
      await tx
        .update(projectMilestones)
        .set({
          title: review.title.trim(),
          dueDate: normalizeOptionalDate(review.dueDate),
          status,
          notes: normalizeOptionalText(review.notes),
          completedAt: status === "completed" ? completionDate : null,
          updatedAt: new Date(),
        })
        .where(and(eq(projectMilestones.projectId, input.projectId), eq(projectMilestones.id, review.id)));
    }

    if (input.stage.trim().toLowerCase() === "completed") {
      const completionDate = new Date(`${input.updateDate}T00:00:00.000Z`);
      const updatedAt = new Date();

      await tx
        .update(projectMilestones)
        .set({
          status: "completed",
          completedAt: completionDate,
          updatedAt,
        })
        .where(
          and(
            eq(projectMilestones.projectId, input.projectId),
            isNull(projectMilestones.completedAt),
            sql`${projectMilestones.status} <> 'completed'`,
          ),
        );

      await tx
        .update(projectMilestones)
        .set({
          status: "completed",
          updatedAt,
        })
        .where(eq(projectMilestones.projectId, input.projectId));
    }
    await resequenceProjectMilestones(input.projectId, tx);

    await recordAuditLog(actor.id, "weekly_update.submit", "project", input.projectId, input.projectId, {
      updateDate: input.updateDate,
      stage: input.stage,
      health: input.health,
      progressPercent: snapshot.progressPercent,
      projectCompleted: input.stage.trim().toLowerCase() === "completed",
      syncedProjectMaster: true,
      syncedWeeklyRisk: isMeaningfulText(blocker),
      syncedNextMilestone: Boolean(updateMilestoneDueDate),
      milestoneReviews: input.milestoneReviews?.length ?? 0,
    }, tx);
    return { syncedProjectMaster: true };
  });
}

export async function syncProjectMasterFromWeeklyUpdates(
  projectId: string,
  actor: AppSessionUser,
) {
  return getDb().transaction(async (db) => {
    const [locked] = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, projectId), projectVisibilityFilter(actor))).for("update");
    if (!locked) throw new RequestError("Project not found.", 404);

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), projectVisibilityFilter(actor)),
      with: {
        milestones: {
          orderBy: [asc(projectMilestones.sortOrder), asc(projectMilestones.dueDate)],
        },
        weeklyUpdates: {
          orderBy: [desc(weeklyUpdates.updateDate)],
        limit: 3,
        },
      },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    if (!project.weeklyUpdates.length) {
      throw new RequestError("No weekly updates are available to sync.");
    }

    const latest = project.weeklyUpdates[0];
    if (project.lastUpdated && latest.updateDate < project.lastUpdated) {
      throw new RequestError("The project snapshot is newer than the latest weekly update.", 409);
    }
    const snapshot = applyWeeklyUpdateToProject(project, latest, project.milestones);
    const currentPosition = buildMasterCurrentPositionFromUpdates(
      project.weeklyUpdates,
      project.currentPosition,
      project.milestones,
    );
    const updated = await db
      .update(projects)
      .set({
        projectStage: snapshot.projectStage,
        health: snapshot.health,
        progressPercent: snapshot.progressPercent,
        managementUpdate: snapshot.managementUpdate,
        actualEndDate: snapshot.actualEndDate,
        currentPosition,
        keyNextAction: latest.nextStep,
        pendingWith: snapshot.pendingWith,
        mainBlockerRisk: snapshot.mainBlockerRisk,
        lastUpdated: latest.updateDate,
        nextMilestone: snapshot.nextMilestone,
        nextMilestoneDate: snapshot.nextMilestoneDate,
      })
      .where(eq(projects.id, projectId))
      .returning();

    await recordAuditLog(actor.id, "project.sync_master_from_weekly", "project", projectId, projectId, {
      weeklyUpdatesUsed: project.weeklyUpdates.length,
      latestUpdateDate: latest.updateDate,
    }, db);

    return updated[0];
  });
}

const emailRunSummaryColumns = {
  id: true, projectId: true, cadence: true, status: true, subject: true, createdAt: true,
} as const;

export async function getDashboardSummary(user: AppSessionUser) {
  const accessibleProjects = await listProjectsForUser(user);
  const db = getDb();
  const projectIds = accessibleProjects.map((project) => project.id);
  const [milestones, recentEmailRuns] = projectIds.length
    ? await Promise.all([
        db.select({
          id: projectMilestones.id,
          projectId: projectMilestones.projectId,
          title: projectMilestones.title,
          dueDate: projectMilestones.dueDate,
          status: projectMilestones.status,
        }).from(projectMilestones).where(and(
          inArray(projectMilestones.projectId, projectIds),
          gte(projectMilestones.dueDate, sql`(now() at time zone ${getEnv().APP_TIMEZONE})::date`),
          sql`${projectMilestones.status} <> 'completed'`,
        )).orderBy(asc(projectMilestones.dueDate)).limit(10),
        db.query.emailRuns.findMany({
          columns: emailRunSummaryColumns,
          where: inArray(emailRuns.projectId, projectIds),
          orderBy: [desc(emailRuns.createdAt)],
          limit: 12,
        }),
      ])
    : [[], []];

  const stageCounts = accessibleProjects.reduce<Record<string, number>>((acc, project) => {
    acc[project.projectStage] = (acc[project.projectStage] ?? 0) + 1;
    return acc;
  }, {});

  const healthCounts = accessibleProjects.reduce<Record<string, number>>((acc, project) => {
    acc[project.health] = (acc[project.health] ?? 0) + 1;
    return acc;
  }, {});

  const priorityCounts = accessibleProjects.reduce<Record<string, number>>((acc, project) => {
    acc[project.priority] = (acc[project.priority] ?? 0) + 1;
    return acc;
  }, {});

  const lateProjects = accessibleProjects
    .filter((project) => tracksReportingCadence(project.projectStage))
    .map((project) => ({
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      lateDays: getLateDays(project.lastUpdated, project.updateFrequency),
    }))
    .filter((project) => project.lateDays > 0 && Number.isFinite(project.lateDays))
    .sort((left, right) => right.lateDays - left.lateDays)
    .slice(0, 10);

  const projectSummaries = new Map(accessibleProjects.map(({ id, projectCode, projectName }) => [
    id, { id, projectCode, projectName },
  ]));
  const upcomingMilestones = milestones.map((milestone) => ({
    ...milestone,
    project: projectSummaries.get(milestone.projectId),
  }));

  return {
    totals: {
      totalProjects: accessibleProjects.length,
      inFlight: accessibleProjects.filter((project) =>
        ["In Progress", "Requirements", "Tendering"].includes(project.projectStage),
      ).length,
      delayed: accessibleProjects.filter((project) => project.projectStage === "Delayed")
        .length,
      critical: accessibleProjects.filter((project) => project.priority === "P1 - Critical")
        .length,
    },
    stageCounts,
    healthCounts,
    priorityCounts,
    lateProjects,
    upcomingMilestones,
    recentEmailRuns,
  };
}

export async function getReportSnapshot(user: AppSessionUser) {
  const db = getDb();
  const projects = (await listProjectsForUser(user)).map(({ id, projectCode, projectName, health }) => ({
    id, projectCode, projectName, health,
  }));
  const ids = projects.map(({ id }) => id);
  if (!ids.length) return { projects, updates: [], overdueMilestones: [], recentEmailRuns: [] };

  const [updates, overdueMilestoneRows, recentEmailRuns] = await Promise.all([
    db.query.weeklyUpdates.findMany({
      columns: { id: true, updateDate: true, stage: true, health: true, whatHappened: true },
      where: inArray(weeklyUpdates.projectId, ids),
      orderBy: [desc(weeklyUpdates.updateDate), desc(weeklyUpdates.createdAt)],
      limit: 25,
    }),
    db.select({
      id: projectMilestones.id,
      projectId: projectMilestones.projectId,
      title: projectMilestones.title,
      dueDate: projectMilestones.dueDate,
      status: projectMilestones.status,
    }).from(projectMilestones).where(and(
      inArray(projectMilestones.projectId, ids),
      lt(projectMilestones.dueDate, sql`(now() at time zone ${getEnv().APP_TIMEZONE})::date`),
      sql`${projectMilestones.status} <> 'completed'`,
    )).orderBy(asc(projectMilestones.dueDate)),
    db.query.emailRuns.findMany({
      columns: emailRunSummaryColumns,
      where: inArray(emailRuns.projectId, ids),
      orderBy: [desc(emailRuns.createdAt)],
      limit: 25,
    }),
  ]);

  const projectSummaries = new Map(projects.map((project) => [project.id, project]));
  const overdueMilestones = overdueMilestoneRows.map((milestone) => ({
    ...milestone,
    projectCode: projectSummaries.get(milestone.projectId)?.projectCode ?? null,
    projectName: projectSummaries.get(milestone.projectId)?.projectName ?? null,
  }));
  return { projects, updates, overdueMilestones, recentEmailRuns };
}

export async function runWorkbookImport(actor: AppSessionUser, filePath?: string) {
  return importWorkbookToDatabase(filePath ?? getEnv().WORKBOOK_IMPORT_PATH, actor.id);
}

export async function triggerProjectEmail(
  actor: AppSessionUser,
  projectId: string,
  cadence: "weekly" | "monthly",
) {
  if (!await getDb().query.projects.findFirst({
    where: and(eq(projects.id, projectId), projectVisibilityFilter(actor)),
    columns: { id: true },
  })) throw new RequestError("Project not found.", 404);
  const result = await sendProjectStatusEmail(projectId, cadence);
  await recordAuditLog(actor.id, "email.send", "project", projectId, projectId, {
    cadence,
    emailRunId: result.id,
    status: result.status,
  });
  return result;
}

export async function seedPmUsers(pmNames: string[], db: ReturnType<typeof getDb> | ProjectTransaction = getDb()) {
  const pmRole = await db.query.roles.findFirst({ where: eq(roles.name, "pm") });

  if (!pmRole) {
    throw new Error("PM role missing");
  }

  const existing = await db.select({
    id: users.id, name: users.name, email: users.email, active: users.active,
  }).from(users).where(eq(users.roleId, pmRole.id));
  const accountsByName = new Map<string, typeof existing>();
  for (const account of existing) {
    const accounts = accountsByName.get(account.name) ?? [];
    accounts.push(account);
    accountsByName.set(account.name, accounts);
  }

  const assignments = new Map<string, string>();
  for (const name of pmNames) {
    const existingAccounts = accountsByName.get(name) ?? [];
    const activeAccounts = existingAccounts.filter(({ active }) => active);
    const provisioned = activeAccounts.filter(({ email }) => !email.endsWith("@imkan.local"));
    const candidates = provisioned.length ? provisioned : activeAccounts;
    if (candidates.length === 1) {
      assignments.set(name, candidates[0].id);
    }
    if (existingAccounts.length) continue;

    const slug = slugifyName(name);
    if (!slug || slug.length > 64) continue;
    const [inserted] = await db.insert(users).values({
      name,
      email: `${slug}@imkan.local`,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
      roleId: pmRole.id,
      active: true,
    }).onConflictDoNothing({ target: users.email }).returning({ id: users.id });
    if (inserted) assignments.set(name, inserted.id);
  }
  return assignments;
}
