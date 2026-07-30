import type { Project, ProjectMilestone } from "@/lib/db/schema";

type ProjectSnapshotFields = Pick<
  Project,
  | "projectStage"
  | "health"
  | "progressPercent"
  | "managementUpdate"
  | "currentPosition"
  | "keyNextAction"
  | "pendingWith"
  | "mainBlockerRisk"
  | "lastUpdated"
  | "actualEndDate"
  | "nextMilestone"
  | "nextMilestoneDate"
>;

export type WeeklyUpdatePayload = {
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
};

function normalizeSentence(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function splitNarrativePoints(value?: string | null) {
  const raw = value?.replace(/\r/g, "").trim() ?? "";

  if (!raw) {
    return [];
  }

  const normalizedBullets = raw.replace(/[•·\u2022]/g, "\n");
  const primaryParts = (normalizedBullets.includes("\n")
    ? normalizedBullets.split(/\n+/)
    : normalizedBullets.split(/(?:\.\s+|;\s+)/))
    .map((part) => part.replace(/\s+/g, " ").replace(/^\d+[\).\s-]*/, "").trim())
    .filter(Boolean);

  return (primaryParts.length > 1
    ? primaryParts
    : normalizedBullets
        .split(/,\s+/)
        .map((part) => part.replace(/\s+/g, " ").replace(/^\d+[\).\s-]*/, "").trim())
        .filter(Boolean))
    .filter(Boolean)
    .map(normalizeSentence)
    .filter(Boolean);
}

export function summarizeWeeklyWhatHappened(stage: string, whatHappened?: string | null) {
  const stageLabel = stage.trim();
  const points = splitNarrativePoints(whatHappened);

  if (!points.length) {
    return stageLabel || null;
  }

  const stagePrefix =
    stageLabel && !points.some((point) => point.toLowerCase().includes(stageLabel.toLowerCase()))
      ? `${stageLabel} is progressing. `
      : "";

  return `${stagePrefix}${points.join(" ")}`.trim();
}

export function deriveNextMilestone(
  milestones: Array<Pick<ProjectMilestone, "title" | "dueDate" | "status" | "sortOrder">>,
) {
  const candidate = milestones
    .filter((milestone) => milestone.status !== "completed")
    .sort((left, right) => {
      const leftDate = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right.dueDate
        ? new Date(right.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      return left.sortOrder - right.sortOrder;
    })[0];

  if (!candidate) {
    return { nextMilestone: null, nextMilestoneDate: null };
  }

  return {
    nextMilestone: candidate.title,
    nextMilestoneDate: candidate.dueDate ?? null,
  };
}

export function applyWeeklyUpdateToProject(
  project: Pick<
    Project,
    | "projectStage"
    | "health"
    | "progressPercent"
    | "managementUpdate"
    | "currentPosition"
    | "keyNextAction"
    | "pendingWith"
    | "mainBlockerRisk"
    | "lastUpdated"
    | "actualEndDate"
    | "nextMilestone"
    | "nextMilestoneDate"
  >,
  update: WeeklyUpdatePayload,
  milestones: Array<Pick<ProjectMilestone, "title" | "dueDate" | "status" | "sortOrder">>,
): ProjectSnapshotFields {
  const isCompleted = update.stage.trim().toLowerCase() === "completed";
  const nextMilestone = deriveNextMilestone(milestones);
  const updateNextMilestone = update.nextMilestone?.trim();
  const requestedProgress =
    update.progressPercent === null || update.progressPercent === undefined
      ? Number.NaN
      : Number(update.progressPercent);
  const progressPercent = isCompleted
    ? 100
    : Number.isFinite(requestedProgress)
      ? Math.min(100, Math.max(0, Math.round(requestedProgress)))
      : project.progressPercent;
  const managementUpdate =
    update.managementUpdate?.trim() ||
    update.currentPosition?.trim() ||
    update.whatHappened.trim() ||
    project.managementUpdate;

  return {
    ...project,
    projectStage: update.stage,
    health: update.health,
    progressPercent,
    managementUpdate,
    currentPosition: update.currentPosition?.trim() || update.whatHappened.trim() || null,
    keyNextAction: update.nextStep,
    pendingWith: isCompleted ? null : update.pendingWith?.trim() || project.pendingWith,
    mainBlockerRisk: isCompleted ? null : update.blocker ?? null,
    lastUpdated: update.updateDate,
    actualEndDate: isCompleted ? update.updateDate : project.actualEndDate,
    nextMilestone: isCompleted
      ? null
      : updateNextMilestone || nextMilestone.nextMilestone || project.nextMilestone,
    nextMilestoneDate: isCompleted
      ? null
      : update.nextMilestoneDate ||
        nextMilestone.nextMilestoneDate ||
        project.nextMilestoneDate,
  };
}

export function getLateDays(lastUpdated: string | null, frequency: string) {
  if (!lastUpdated) {
    return Number.POSITIVE_INFINITY;
  }

  const last = new Date(lastUpdated);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  const threshold =
    frequency === "Weekly"
      ? 7
      : frequency === "Bi Weekly"
        ? 14
        : frequency === "Monthly"
          ? 30
          : 999;

  return Math.max(0, diffDays - threshold);
}

export function tracksReportingCadence(projectStage: string) {
  const normalizedStage = projectStage.trim().toLowerCase();

  return normalizedStage !== "completed" && normalizedStage !== "not started";
}
