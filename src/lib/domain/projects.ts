import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";

import type { AppSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  auditLogs,
  emailRuns,
  lookupValues,
  passwordResetTokens,
  projectEmailRecipients,
  projectMilestones,
  projectRisks,
  projects,
  roles,
  users,
  weeklyUpdates,
} from "@/lib/db/schema";
import { buildMasterCurrentPositionFromUpdates } from "@/lib/domain/project-master-sync";
import { applyWeeklyUpdateToProject, getLateDays, tracksReportingCadence } from "@/lib/domain/project-sync";
import { DEFAULT_PROJECT_EMAIL_RECIPIENT } from "@/lib/email/defaults";
import { getEnv } from "@/lib/env";
import { importWorkbookToDatabase } from "@/lib/import/workbook";
import { sendProjectStatusEmail } from "@/lib/email/service";
import { isMeaningfulText, slugifyName, toDateOnly } from "@/lib/utils/format";

export type LookupCatalog = Record<string, string[]>;

export async function ensureBaseRoles() {
  const db = getDb();
  await db
    .insert(roles)
    .values([
      { name: "admin", label: "Administrator" },
      { name: "pm", label: "Project Manager" },
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
    .returning();

  return inserted[0];
}

export async function ensurePasswordResetToken(userId: string) {
  const db = getDb();
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  const inserted = await db
    .insert(passwordResetTokens)
    .values({
      userId,
      token,
      expiresAt,
    })
    .returning();

  return inserted[0];
}

export async function resetPasswordWithToken(token: string, password: string) {
  const db = getDb();
  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.token, token),
  });

  if (!resetToken || resetToken.consumedAt || resetToken.expiresAt < new Date()) {
    throw new Error("Invalid or expired token");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId));
    await tx
      .update(passwordResetTokens)
      .set({ consumedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));
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

function projectVisibilityFilter(user: AppSessionUser) {
  if (user.role === "admin" || user.role === "viewer") {
    return eq(projects.archived, false);
  }

  return and(
    eq(projects.archived, false),
    or(eq(projects.primaryPmUserId, user.id), eq(projects.pmName, user.name)),
  );
}

export async function listProjectsForUser(user: AppSessionUser) {
  const db = getDb();

  return db.query.projects.findMany({
    where: projectVisibilityFilter(user),
    orderBy: [asc(projects.projectCode)],
    with: {
      milestones: {
        orderBy: [asc(projectMilestones.sortOrder), asc(projectMilestones.dueDate)],
      },
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
        orderBy: [desc(weeklyUpdates.updateDate), desc(weeklyUpdates.createdAt)],
      },
      emailRuns: {
        orderBy: [desc(emailRuns.createdAt)],
        limit: 10,
      },
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
) {
  const db = getDb();
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
  const db = getDb();
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
  });

  return inserted[0];
}

export async function updateProject(
  projectId: string,
  input: ProjectInput,
  actor: AppSessionUser,
) {
  const db = getDb();

  const updated = await db
    .update(projects)
    .set({
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
    .where(eq(projects.id, projectId))
    .returning();

  if (input.recipients) {
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
    projectCode: input.projectCode,
  });

  return updated[0];
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
  const db = getDb();
  const existing = await db.query.projectMilestones.findMany({
    where: eq(projectMilestones.projectId, projectId),
    columns: { id: true },
  });
  const keepIds = milestones.filter((item) => item.id).map((item) => item.id as string);

  if (existing.length && keepIds.length !== existing.length) {
    const deleteIds = existing
      .map((item) => item.id)
      .filter((id) => !keepIds.includes(id));

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
      await db
        .update(projectMilestones)
        .set({
          title: milestone.title,
          dueDate: milestone.dueDate ?? null,
          status: milestone.status,
          owner: milestone.owner ?? null,
          notes: milestone.notes ?? null,
          sortOrder: milestone.sortOrder,
          completedAt: milestone.status === "completed" ? new Date() : null,
        })
        .where(eq(projectMilestones.id, milestone.id));
    } else {
      await db.insert(projectMilestones).values({
        projectId,
        title: milestone.title,
        dueDate: milestone.dueDate ?? null,
        status: milestone.status,
        owner: milestone.owner ?? null,
        notes: milestone.notes ?? null,
        sortOrder: milestone.sortOrder,
        completedAt: milestone.status === "completed" ? new Date() : null,
      });
    }
  }

  await resequenceProjectMilestones(projectId);

  const refreshedMilestones = await db.query.projectMilestones.findMany({
    where: eq(projectMilestones.projectId, projectId),
  });

  const nextMilestone = applyWeeklyUpdateToProject(
    {
      projectStage: "",
      health: "",
      currentPosition: null,
      keyNextAction: null,
      pendingWith: null,
      mainBlockerRisk: null,
      lastUpdated: null,
      nextMilestone: null,
      nextMilestoneDate: null,
    },
    {
      updateDate: toDateOnly(new Date()) ?? "",
      stage: "",
      health: "",
      whatHappened: "",
      nextStep: "",
    },
    refreshedMilestones,
  );

  await db
    .update(projects)
    .set({
      nextMilestone: nextMilestone.nextMilestone,
      nextMilestoneDate: nextMilestone.nextMilestoneDate,
    })
    .where(eq(projects.id, projectId));

  await recordAuditLog(actor.id, "milestones.replace", "project", projectId, projectId, {
    count: milestones.length,
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
  const db = getDb();
  const existing = await db.query.projectRisks.findMany({
    where: eq(projectRisks.projectId, projectId),
    columns: { id: true },
  });
  const keepIds = risks.filter((item) => item.id).map((item) => item.id as string);

  if (existing.length && keepIds.length !== existing.length) {
    const deleteIds = existing
      .map((item) => item.id)
      .filter((id) => !keepIds.includes(id));

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
          targetDate: risk.targetDate ?? null,
          sortOrder: risk.sortOrder,
        })
        .where(eq(projectRisks.id, risk.id));
    } else {
      await db.insert(projectRisks).values({
        projectId,
        title: risk.title,
        description: risk.description,
        owner: risk.owner ?? null,
        mitigationPlan: risk.mitigationPlan ?? null,
        status: risk.status,
        severity: risk.severity,
        targetDate: risk.targetDate ?? null,
        sortOrder: risk.sortOrder,
      });
    }
  }

  await recordAuditLog(actor.id, "risks.replace", "project", projectId, projectId, {
    count: risks.length,
  });
}

type WeeklyUpdateInput = {
  projectId: string;
  updateDate: string;
  stage: string;
  health: string;
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

async function resequenceProjectMilestones(projectId: string) {
  const db = getDb();
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

function findMatchingMilestone<
  T extends {
    title: string;
    dueDate?: string | Date | null;
    status: string;
    sortOrder: number;
    notes?: string | null;
  }
>(
  milestones: T[],
  nextMilestoneTitle: string,
  nextMilestoneDate?: string | null,
): T | null {
  const normalizedTitle = normalizeComparableText(nextMilestoneTitle);
  const normalizedDueDate = normalizeMilestoneDate(nextMilestoneDate);
  const exactTitleMatch = milestones.find(
    (milestone) => normalizeComparableText(milestone.title) === normalizedTitle,
  );

  if (exactTitleMatch) {
    return exactTitleMatch;
  }

  if (!normalizedDueDate) {
    return null;
  }

  return (
    sortMilestoneRecords(milestones).find(
      (milestone) =>
        milestone.status !== "completed" &&
        normalizeMilestoneDate(milestone.dueDate) === normalizedDueDate,
    ) ?? null
  );
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
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    with: {
      milestones: true,
      risks: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const snapshot = applyWeeklyUpdateToProject(project, input, project.milestones);
  const blocker = normalizeOptionalText(input.blocker);
  const currentPosition = normalizeOptionalText(input.currentPosition);
  const pendingWith = normalizeOptionalText(input.pendingWith);
  const nextMilestoneTitle = normalizeOptionalText(input.nextMilestone);
  const nextMilestoneDate = normalizeOptionalDate(input.nextMilestoneDate);
  const helpNeeded = normalizeOptionalText(input.helpNeeded);
  const existingWeeklyRisk = project.risks.find(
    (risk) => normalizeComparableText(risk.title) === normalizeComparableText(WEEKLY_UPDATE_RISK_TITLE),
  );
  const existingNextMilestone = nextMilestoneTitle
    ? findMatchingMilestone(project.milestones, nextMilestoneTitle, nextMilestoneDate)
    : null;

  await db.transaction(async (tx) => {
    await tx.insert(weeklyUpdates).values({
      projectId: input.projectId,
      updateDate: input.updateDate,
      stage: input.stage,
      health: input.health,
      currentPosition,
      whatHappened: input.whatHappened,
      nextStep: input.nextStep,
      blocker,
      pendingWith,
      nextMilestone: nextMilestoneTitle,
      nextMilestoneDate,
      helpNeeded,
      submittedBy: actor.id,
    });

    await tx
      .update(projects)
      .set({
        projectStage: snapshot.projectStage,
        health: snapshot.health,
        currentPosition: snapshot.currentPosition,
        keyNextAction: snapshot.keyNextAction,
        pendingWith: snapshot.pendingWith,
        mainBlockerRisk: snapshot.mainBlockerRisk,
        lastUpdated: snapshot.lastUpdated,
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
            targetDate: nextMilestoneDate,
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
          targetDate: nextMilestoneDate,
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

    if (nextMilestoneTitle && existingNextMilestone) {
      await tx
        .update(projectMilestones)
        .set({
          title: nextMilestoneTitle,
          dueDate: nextMilestoneDate ?? normalizeMilestoneDate(existingNextMilestone.dueDate),
          status: existingNextMilestone.status === "completed" ? "in_progress" : existingNextMilestone.status,
          notes:
            existingNextMilestone.status === "completed"
              ? "Reopened from the latest weekly update."
              : existingNextMilestone.notes,
          updatedAt: new Date(),
        })
        .where(eq(projectMilestones.id, existingNextMilestone.id));
    }

    for (const review of input.milestoneReviews ?? []) {
      const status = normalizeMilestoneReviewStatus(review.status);
      await tx
        .update(projectMilestones)
        .set({
          title: review.title.trim(),
          dueDate: normalizeOptionalDate(review.dueDate),
          status,
          notes: normalizeOptionalText(review.notes),
          completedAt:
            status === "completed"
              ? review.completedAt
                ? new Date(review.completedAt)
                : new Date()
              : null,
          updatedAt: new Date(),
        })
        .where(and(eq(projectMilestones.projectId, input.projectId), eq(projectMilestones.id, review.id)));
    }
  });

  await resequenceProjectMilestones(input.projectId);

  await recordAuditLog(actor.id, "weekly_update.submit", "project", input.projectId, input.projectId, {
    updateDate: input.updateDate,
    stage: input.stage,
    health: input.health,
    syncedProjectMaster: true,
    syncedWeeklyRisk: isMeaningfulText(blocker),
    syncedNextMilestone: Boolean(nextMilestoneTitle && existingNextMilestone),
    milestoneReviews: input.milestoneReviews?.length ?? 0,
  });
}

export async function syncProjectMasterFromWeeklyUpdates(
  projectId: string,
  actor: AppSessionUser,
) {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      milestones: {
        orderBy: [asc(projectMilestones.sortOrder), asc(projectMilestones.dueDate)],
      },
      weeklyUpdates: {
        orderBy: [desc(weeklyUpdates.updateDate), desc(weeklyUpdates.createdAt)],
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.weeklyUpdates.length) {
    throw new Error("No weekly updates are available to sync.");
  }

  const latest = project.weeklyUpdates[0];
  const currentPosition = buildMasterCurrentPositionFromUpdates(
    project.weeklyUpdates,
    project.currentPosition,
    project.milestones,
  );
  const updated = await db
    .update(projects)
    .set({
      projectStage: latest.stage,
      health: latest.health,
      currentPosition,
      keyNextAction: latest.nextStep,
      pendingWith: normalizeOptionalText(latest.pendingWith),
      mainBlockerRisk: normalizeOptionalText(latest.blocker),
      lastUpdated: latest.updateDate,
      nextMilestone: normalizeOptionalText(latest.nextMilestone) ?? project.nextMilestone,
      nextMilestoneDate: normalizeOptionalDate(latest.nextMilestoneDate) ?? project.nextMilestoneDate,
    })
    .where(eq(projects.id, projectId))
    .returning();

  await recordAuditLog(actor.id, "project.sync_master_from_weekly", "project", projectId, projectId, {
    weeklyUpdatesUsed: project.weeklyUpdates.length,
    latestUpdateDate: latest.updateDate,
  });

  return updated[0];
}

export async function getDashboardSummary(user: AppSessionUser) {
  const accessibleProjects = await listProjectsForUser(user);
  const db = getDb();
  const projectIds = accessibleProjects.map((project) => project.id);
  const milestones = projectIds.length
    ? await db
        .select({
          id: projectMilestones.id,
          projectId: projectMilestones.projectId,
          title: projectMilestones.title,
          dueDate: projectMilestones.dueDate,
          status: projectMilestones.status,
        })
        .from(projectMilestones)
        .where(inArray(projectMilestones.projectId, projectIds))
    : [];
  const recentEmailRuns = projectIds.length
    ? await db.query.emailRuns.findMany({
        where: inArray(emailRuns.projectId, projectIds),
        orderBy: [desc(emailRuns.createdAt)],
        limit: 12,
      })
    : [];

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
      ...project,
      lateDays: getLateDays(project.lastUpdated, project.updateFrequency),
    }))
    .filter((project) => project.lateDays > 0 && Number.isFinite(project.lateDays))
    .sort((left, right) => right.lateDays - left.lateDays)
    .slice(0, 10);

  const upcomingMilestones = milestones
    .filter((milestone) => milestone.dueDate && milestone.status !== "completed")
    .sort((left, right) => left.dueDate!.localeCompare(right.dueDate!))
    .slice(0, 10)
    .map((milestone) => ({
      ...milestone,
      project: accessibleProjects.find((project) => project.id === milestone.projectId),
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
  const projects = await listProjectsForUser(user);
  const db = getDb();
  const updates = projects.length
    ? await db.query.weeklyUpdates.findMany({
        where: inArray(
          weeklyUpdates.projectId,
          projects.map((project) => project.id),
        ),
        orderBy: [desc(weeklyUpdates.updateDate)],
        limit: 25,
      })
    : [];

  const projectSummariesById = new Map(
    projects.map((project) => [
      project.id,
      {
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
    ]),
  );
  const overdueMilestoneRows = projects.length
    ? await db
        .select({
          id: projectMilestones.id,
          projectId: projectMilestones.projectId,
          title: projectMilestones.title,
          dueDate: projectMilestones.dueDate,
          status: projectMilestones.status,
        })
        .from(projectMilestones)
        .where(
          and(
            inArray(projectMilestones.projectId, projects.map((project) => project.id)),
            isNotNull(projectMilestones.dueDate),
            sql`${projectMilestones.dueDate} < CURRENT_DATE`,
            sql`${projectMilestones.status} <> 'completed'`,
          ),
        )
    : [];
  const overdueMilestones = overdueMilestoneRows.map((milestone) => ({
    ...milestone,
    projectCode: projectSummariesById.get(milestone.projectId)?.projectCode ?? null,
    projectName: projectSummariesById.get(milestone.projectId)?.projectName ?? null,
  }));

  const recentEmailRuns = projects.length
    ? await db.query.emailRuns.findMany({
        where: inArray(
          emailRuns.projectId,
          projects.map((project) => project.id),
        ),
        orderBy: [desc(emailRuns.createdAt)],
        limit: 25,
      })
    : [];

  return { projects, updates, overdueMilestones, recentEmailRuns };
}

export async function runWorkbookImport(actor: AppSessionUser, filePath?: string) {
  const summary = await importWorkbookToDatabase(filePath ?? getEnv().WORKBOOK_IMPORT_PATH);
  await recordAuditLog(actor.id, "import.workbook", "system", "workbook-import", null, summary);
  return summary;
}

export async function triggerProjectEmail(
  actor: AppSessionUser,
  projectId: string,
  cadence: "weekly" | "monthly",
) {
  const result = await sendProjectStatusEmail(projectId, cadence);
  await recordAuditLog(actor.id, "email.send", "project", projectId, projectId, {
    cadence,
    emailRunId: result.id,
    status: result.status,
  });
  return result;
}

export async function seedPmUsers(pmNames: string[]) {
  const db = getDb();
  await ensureBaseRoles();
  const pmRole = await db.query.roles.findFirst({ where: eq(roles.name, "pm") });

  if (!pmRole) {
    throw new Error("PM role missing");
  }

  const adminPasswordHash = await bcrypt.hash(getEnv().DEFAULT_ADMIN_PASSWORD, 10);
  for (const pmName of pmNames.filter(Boolean)) {
    const email = `${slugifyName(pmName)}@imkan.local`;
    await db
      .insert(users)
      .values({
        name: pmName,
        email,
        passwordHash: adminPasswordHash,
        roleId: pmRole.id,
        active: true,
      })
      .onConflictDoNothing();
  }
}
