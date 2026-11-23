import { z } from "zod";

const text = z.string().max(20_000).nullish();
const name = z.string().max(255).nullish();
const date = z.union([z.iso.date(), z.literal("")]).nullish();
const uuid = z.string().uuid();
const progress = z.number().int().min(0).max(100);
const amount = z.union([z.string().regex(/^(?:\d{1,12}(?:\.\d{1,2})?)?$/), z.number().nonnegative().max(999_999_999_999.99)]).nullish()
  .transform((value) => typeof value === "number" ? String(value) : value);
const progressInput = z.union([progress, z.string().regex(/^(?:100|[0-9]{1,2})?$/)]).nullish();

export const projectInput = z.object({
  projectCode: z.string().trim().min(1).max(32),
  projectName: z.string().trim().min(1).max(255),
  projectStage: z.string().trim().min(1).max(64),
  pmName: z.string().max(255),
  projectSponsor: name,
  projectDescription: text,
  progressPercent: progressInput,
  health: z.string().max(32),
  priority: z.string().max(32),
  currentPosition: text,
  keyNextAction: text,
  pendingWith: name,
  mainBlockerRisk: text,
  managementUpdate: text,
  nextMilestone: text,
  nextMilestoneDate: date,
  lastUpdated: date,
  updateFrequency: z.string().max(32),
  startDate: date,
  endDate: date,
  actualEndDate: date,
  budgetCurrency: z.string().max(8).nullish(),
  contractValue: amount,
  actualSpendToDate: amount,
  primaryPmUserId: z.union([uuid, z.literal("")]).nullish(),
  weeklyEmailEnabled: z.boolean().optional(),
  monthlyEmailEnabled: z.boolean().optional(),
  recipients: z.array(z.object({
    email: z.string().trim().max(255).email(),
    recipientType: z.enum(["to", "cc"]),
    name: z.string().max(128).nullish(),
  })).max(100).optional(),
});

const milestone = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1).max(500),
  dueDate: date,
  status: z.enum(["planned", "in_progress", "at_risk", "completed"]),
  owner: name,
  notes: text,
  sortOrder: z.number().int().min(0).max(10_000),
});

export const milestoneListInput = z.object({ milestones: z.array(milestone).max(500) });
export const riskListInput = z.object({
  risks: z.array(z.object({
    id: uuid.optional(),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().min(1).max(20_000),
    owner: name,
    mitigationPlan: text,
    status: z.enum(["open", "monitoring", "mitigated", "closed"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    targetDate: date,
    sortOrder: z.number().int().min(0).max(10_000),
  })).max(500),
});

export const weeklyUpdateInput = z.object({
  projectId: uuid,
  updateDate: z.iso.date(),
  stage: z.string().trim().min(1).max(64),
  health: z.string().trim().min(1).max(32),
  progressPercent: progress.nullish(),
  managementUpdate: text,
  currentPosition: text,
  whatHappened: z.string().trim().min(1).max(20_000),
  nextStep: z.string().trim().min(1).max(20_000),
  blocker: text,
  pendingWith: name,
  nextMilestone: text,
  nextMilestoneDate: date,
  helpNeeded: text,
  milestoneReviews: z.array(
    milestone.omit({ owner: true, sortOrder: true }).extend({
      id: uuid,
      completedAt: date,
    }),
  ).max(500).optional(),
});
