import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 32 }).notNull().unique(),
  label: varchar("label", { length: 64 }).notNull(),
}).enableRLS();

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
).enableRLS();

export const lookupValues = pgTable("lookup_values", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: varchar("category", { length: 64 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    projectName: text("project_name").notNull(),
    projectStage: varchar("project_stage", { length: 64 }).notNull(),
    pmName: varchar("pm_name", { length: 255 }).notNull(),
    projectSponsor: varchar("project_sponsor", { length: 255 }),
    projectDescription: text("project_description"),
    progressPercent: integer("progress_percent"),
    health: varchar("health", { length: 32 }).notNull(),
    priority: varchar("priority", { length: 32 }).notNull(),
    currentPosition: text("current_position"),
    keyNextAction: text("key_next_action"),
    pendingWith: varchar("pending_with", { length: 255 }),
    mainBlockerRisk: text("main_blocker_risk"),
    managementUpdate: text("management_update"),
    nextMilestone: text("next_milestone"),
    nextMilestoneDate: date("next_milestone_date"),
    lastUpdated: date("last_updated"),
    updateFrequency: varchar("update_frequency", { length: 32 }).notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    actualEndDate: date("actual_end_date"),
    budgetCurrency: varchar("budget_currency", { length: 8 }),
    contractValue: numeric("contract_value", { precision: 14, scale: 2 }),
    actualSpendToDate: numeric("actual_spend_to_date", { precision: 14, scale: 2 }),
    primaryPmUserId: uuid("primary_pm_user_id").references(() => users.id),
    weeklyEmailEnabled: boolean("weekly_email_enabled").notNull().default(true),
    monthlyEmailEnabled: boolean("monthly_email_enabled")
      .notNull()
      .default(true),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    projectCodeIdx: uniqueIndex("projects_project_code_idx").on(table.projectCode),
  }),
).enableRLS();

export const projectMilestones = pgTable("project_milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: date("due_date"),
  status: varchar("status", { length: 32 }).notNull().default("planned"),
  owner: varchar("owner", { length: 255 }),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("project_milestones_project_sort_idx").on(table.projectId, table.sortOrder, table.dueDate),
  index("project_milestones_open_due_idx").on(table.dueDate, table.projectId).where(sql`${table.status} <> 'completed'`),
]).enableRLS();

export const projectRisks = pgTable("project_risks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  owner: varchar("owner", { length: 255 }),
  mitigationPlan: text("mitigation_plan"),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  severity: varchar("severity", { length: 32 }).notNull().default("medium"),
  targetDate: date("target_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("project_risks_project_sort_idx").on(table.projectId, table.sortOrder, table.targetDate),
]).enableRLS();

export const weeklyUpdates = pgTable(
  "weekly_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    updateDate: date("update_date").notNull(),
    stage: varchar("stage", { length: 64 }).notNull(),
    health: varchar("health", { length: 32 }).notNull(),
    progressPercent: integer("progress_percent"),
    managementUpdate: text("management_update"),
    currentPosition: text("current_position"),
    whatHappened: text("what_happened").notNull(),
    nextStep: text("next_step").notNull(),
    blocker: text("blocker"),
    pendingWith: varchar("pending_with", { length: 255 }),
    nextMilestone: text("next_milestone"),
    nextMilestoneDate: date("next_milestone_date"),
    helpNeeded: text("help_needed"),
    submittedBy: uuid("submitted_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    projectDateIdx: uniqueIndex("weekly_updates_project_date_idx").on(
      table.projectId,
      table.updateDate,
    ),
  }),
).enableRLS();

export const projectEmailRecipients = pgTable("project_email_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  recipientType: varchar("recipient_type", { length: 16 }).notNull(),
  name: varchar("name", { length: 128 }),
  email: varchar("email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("project_email_recipients_project_idx").on(table.projectId),
]).enableRLS();

export const emailRuns = pgTable("email_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  cadence: varchar("cadence", { length: 16 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  subject: text("subject"),
  recipients: jsonb("recipients")
    .$type<{ to: string[]; cc: string[] }>()
    .notNull()
    .default(sql`'{"to": [], "cc": []}'::jsonb`),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("email_runs_project_created_idx").on(table.projectId, table.createdAt.desc()),
  index("email_runs_project_sent_idx").on(table.projectId, table.sentAt.desc()).where(sql`${table.status} = 'sent'`),
]).enableRLS();

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: varchar("entity_id", { length: 128 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("password_reset_tokens_user_expiry_idx").on(table.userId, table.expiresAt),
]).enableRLS();

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  ownedProjects: many(projects),
  weeklyUpdates: many(weeklyUpdates),
  auditLogs: many(auditLogs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  primaryPmUser: one(users, {
    fields: [projects.primaryPmUserId],
    references: [users.id],
  }),
  milestones: many(projectMilestones),
  risks: many(projectRisks),
  weeklyUpdates: many(weeklyUpdates),
  recipients: many(projectEmailRecipients),
  emailRuns: many(emailRuns),
  auditLogs: many(auditLogs),
}));

export const projectMilestonesRelations = relations(
  projectMilestones,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectMilestones.projectId],
      references: [projects.id],
    }),
  }),
);

export const projectRisksRelations = relations(projectRisks, ({ one }) => ({
  project: one(projects, {
    fields: [projectRisks.projectId],
    references: [projects.id],
  }),
}));

export const weeklyUpdatesRelations = relations(weeklyUpdates, ({ one }) => ({
  project: one(projects, {
    fields: [weeklyUpdates.projectId],
    references: [projects.id],
  }),
  submittedByUser: one(users, {
    fields: [weeklyUpdates.submittedBy],
    references: [users.id],
  }),
}));

export const projectEmailRecipientsRelations = relations(
  projectEmailRecipients,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectEmailRecipients.projectId],
      references: [projects.id],
    }),
  }),
);

export const emailRunsRelations = relations(emailRuns, ({ one }) => ({
  project: one(projects, {
    fields: [emailRuns.projectId],
    references: [projects.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [auditLogs.projectId],
    references: [projects.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type WeeklyUpdate = typeof weeklyUpdates.$inferSelect;
export type NewWeeklyUpdate = typeof weeklyUpdates.$inferInsert;
export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type ProjectEmailRecipient = typeof projectEmailRecipients.$inferSelect;
export type EmailRun = typeof emailRuns.$inferSelect;
export type User = typeof users.$inferSelect;
