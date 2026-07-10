import type { ProjectMilestone } from "../db/schema";

type NarrativeSection = {
  heading: string;
  lines: string[];
};

const MANAGED_NARRATIVE_HEADINGS = new Set([
  "current status",
  "recent updates",
  "current focus",
  "key risk",
  "current action owner",
]);

function formatSyncDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function compactSyncText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*(\\n|\n)\s*/g, " ")
    .trim();
}

function trimNarrativeSectionLines(lines: string[]) {
  let start = 0;
  let end = lines.length;

  while (start < end && !lines[start].trim()) {
    start += 1;
  }

  while (end > start && !lines[end - 1].trim()) {
    end -= 1;
  }

  return lines.slice(start, end);
}

function isNarrativeHeading(line: string) {
  const normalized = line.trim().replace(/:$/, "");
  return /^[A-Za-z][A-Za-z ]*$/.test(normalized);
}

function parseNarrativeSections(source?: string | null) {
  const text = String(source ?? "").replace(/\r/g, "");
  const lines = text.split("\n");
  const sections: NarrativeSection[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (isNarrativeHeading(line)) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          lines: trimNarrativeSectionLines(currentLines),
        });
      }

      currentHeading = line.trim().replace(/:$/, "");
      currentLines = [];
      continue;
    }

    if (currentHeading) {
      currentLines.push(line);
    }
  }

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      lines: trimNarrativeSectionLines(currentLines),
    });
  }

  return sections.filter((section) => section.lines.some((line) => line.trim()));
}

function formatNarrativeSection(section: NarrativeSection) {
  if (!section.lines.length) {
    return null;
  }

  return `\n${section.heading}:\n${section.lines.join("\n")}`;
}

function extractPreservedNarrativeSections(source?: string | null) {
  return parseNarrativeSections(source).filter(
    (section) => !MANAGED_NARRATIVE_HEADINGS.has(section.heading.toLowerCase()),
  );
}

function selectSyncMilestones<T extends { status: string }>(milestones: T[], limit = 8) {
  if (milestones.length <= limit) {
    return milestones;
  }

  const firstActiveIndex = milestones.findIndex((milestone) => milestone.status !== "completed");

  if (firstActiveIndex === -1) {
    return milestones.slice(-limit);
  }

  const desiredStart = firstActiveIndex - Math.floor(limit / 2);
  const latestPossibleStart = milestones.length - limit;
  const start = Math.max(0, Math.min(desiredStart, latestPossibleStart));

  return milestones.slice(start, start + limit);
}

function formatMilestoneRange(value?: string | null) {
  if (!value) {
    return null;
  }

  const endDate = new Date(value);
  if (Number.isNaN(endDate.getTime())) {
    return formatSyncDate(value);
  }

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6);

  const startDay = new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(startDate);
  const endDay = new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(endDate);
  const startMonth = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(startDate);
  const endMonth = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(endDate);

  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startDay}-${endDay} ${endMonth}`;
  }

  return `${startDay} ${startMonth}-${endDay} ${endMonth}`;
}

function cleanMilestoneNarrativeNotes(title: string, notes?: string | null) {
  const compactNotes = compactSyncText(notes);

  if (!compactNotes) {
    return title;
  }

  const implementationWeekMatch = title.match(/^Implementation Week (\d+):\s*(.+)$/i);
  if (!implementationWeekMatch) {
    return compactNotes;
  }

  return compactNotes.replace(/^Week \d+ focus:\s*/i, "");
}

function buildImplementationMilestonesSection(
  milestones: Array<Pick<ProjectMilestone, "title" | "dueDate" | "notes" | "sortOrder" | "status">>,
) {
  const implementationMilestones = milestones
    .filter(
      (milestone) =>
        /^Implementation Week \d+:/i.test(milestone.title) || milestone.title.trim() === "Go Live",
    )
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return (left.dueDate ?? "").localeCompare(right.dueDate ?? "");
    });

  if (!implementationMilestones.length) {
    return null;
  }

  const selectedMilestones = selectSyncMilestones(implementationMilestones, 8);
  const lines = selectedMilestones.map((milestone) => {
    const weekMatch = milestone.title.match(/^Implementation Week (\d+):\s*(.+)$/i);
    if (weekMatch) {
      const range = formatMilestoneRange(milestone.dueDate);
      const details = cleanMilestoneNarrativeNotes(weekMatch[2], milestone.notes);
      return `- Week ${weekMatch[1]}${range ? `, ${range}` : ""}: ${details}`;
    }

    if (milestone.title.trim() === "Go Live") {
      const details = cleanMilestoneNarrativeNotes(milestone.title, milestone.notes);
      return `- Go Live${milestone.dueDate ? `, ${formatSyncDate(milestone.dueDate)}` : ""}: ${details}`;
    }

    const details = cleanMilestoneNarrativeNotes(milestone.title, milestone.notes);
    return `- ${milestone.title}${milestone.dueDate ? `, ${formatSyncDate(milestone.dueDate)}` : ""}: ${details}`;
  });

  return {
    heading: "Implementation Milestones",
    lines,
  } satisfies NarrativeSection;
}

export function buildMasterCurrentPositionFromUpdates(
  updates: Array<{
    updateDate: string;
    stage: string;
    health: string;
    currentPosition?: string | null;
    whatHappened: string;
    nextStep: string;
    blocker?: string | null;
    pendingWith?: string | null;
  }>,
  existingCurrentPosition?: string | null,
  milestones: Array<
    Pick<ProjectMilestone, "title" | "dueDate" | "notes" | "sortOrder" | "status">
  > = [],
) {
  const latest = updates[0];
  const recentUpdates = updates.slice(0, 3);
  const progressNarrative = recentUpdates
    .map((update) => `- ${formatSyncDate(update.updateDate)}: ${compactSyncText(update.whatHappened)}`)
    .join("\n");
  const position = compactSyncText(latest.currentPosition);
  const focus = compactSyncText(latest.nextStep);
  const blocker = compactSyncText(latest.blocker);
  const pendingWith = compactSyncText(latest.pendingWith);
  const preservedSections = extractPreservedNarrativeSections(existingCurrentPosition);
  const implementationMilestonesSection =
    preservedSections.find((section) => section.heading.toLowerCase() === "implementation milestones") ??
    buildImplementationMilestonesSection(milestones);

  return [
    `As of ${formatSyncDate(latest.updateDate)}, the project is ${latest.stage} with ${latest.health} health.`,
    position ? `\nCurrent Status:\n${position}` : null,
    progressNarrative ? `\nRecent Updates:\n${progressNarrative}` : null,
    implementationMilestonesSection ? formatNarrativeSection(implementationMilestonesSection) : null,
    ...preservedSections
      .filter((section) => section.heading.toLowerCase() !== "implementation milestones")
      .map(formatNarrativeSection),
    focus ? `\nCurrent Focus:\n${focus}` : null,
    blocker ? `\nKey Risk:\n${blocker}` : null,
    pendingWith ? `\nCurrent Action Owner:\n${pendingWith}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
