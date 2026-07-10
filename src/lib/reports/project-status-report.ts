import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deriveProgressPercent, formatDisplayDate } from "@/lib/utils/format";

export type ReportCadence = "weekly" | "monthly";

export type ProjectReportData = {
  id: string;
  projectCode: string;
  projectName: string;
  projectStage: string;
  pmName: string;
  projectSponsor?: string | null;
  projectDescription?: string | null;
  progressPercent?: number | null;
  health: string;
  priority: string;
  currentPosition?: string | null;
  keyNextAction?: string | null;
  pendingWith?: string | null;
  mainBlockerRisk?: string | null;
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
  weeklyEmailEnabled?: boolean;
  monthlyEmailEnabled?: boolean;
  recipients: Array<{ id: string; email: string; recipientType: string; name?: string | null }>;
  milestones: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    status: string;
    owner?: string | null;
    notes?: string | null;
    sortOrder: number;
  }>;
  risks: Array<{
    id: string;
    title: string;
    description: string;
    owner?: string | null;
    mitigationPlan?: string | null;
    status: string;
    severity: string;
    targetDate?: string | null;
    sortOrder: number;
  }>;
  weeklyUpdates: Array<{
    id: string;
    updateDate: string;
    stage: string;
    health: string;
    currentPosition?: string | null;
    whatHappened: string;
    nextStep: string;
    blocker?: string | null;
    helpNeeded?: string | null;
  }>;
  emailRuns?: Array<{
    id: string;
    cadence: string;
    status: string;
    subject?: string | null;
    sentAt?: string | Date | null;
    createdAt: string | Date;
  }>;
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadLogoDataUri(fileName: string, mimeType: string) {
  try {
    const filePath = join(process.cwd(), "public", fileName);
    const buffer = readFileSync(filePath);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function loadImkanLogoDataUri() {
  return loadLogoDataUri("imkan-logo.png", "image/png");
}

function loadSaalLogoDataUri() {
  return loadLogoDataUri("saal-logo.svg", "image/svg+xml");
}

function healthTone(health: string) {
  if (health === "Red") {
    return { bg: "#da1e28", fg: "#ffffff" };
  }

  if (health === "Amber") {
    return { bg: "#ffbf3f", fg: "#161616" };
  }

  if (health === "Grey") {
    return { bg: "#8d8d8d", fg: "#ffffff" };
  }

  return { bg: "#8cd211", fg: "#161616" };
}

function milestoneTone(status: string) {
  if (status === "completed") {
    return { bg: "#4589ff", fg: "#ffffff", label: "Complete" };
  }

  if (status === "in_progress") {
    return { bg: "#8cd211", fg: "#161616", label: "On Track" };
  }

  if (status === "at_risk") {
    return { bg: "#ffbf3f", fg: "#161616", label: "At Risk" };
  }

  return { bg: "#d9d9d9", fg: "#161616", label: "Planned" };
}

function riskStatusTone(status: string) {
  if (status === "closed") {
    return { bg: "#24a148", fg: "#ffffff", label: "Closed" };
  }

  if (status === "mitigated") {
    return { bg: "#0f62fe", fg: "#ffffff", label: "Mitigated" };
  }

  if (status === "monitoring") {
    return { bg: "#525252", fg: "#ffffff", label: "Monitoring" };
  }

  return { bg: "#da1e28", fg: "#ffffff", label: "Open" };
}

function reportPhaseLabel(projectStage: string) {
  return projectStage === "In Progress" ? "Project Execution In Progress" : projectStage;
}

function reportPhaseTone(projectStage: string, isCompletedProject: boolean, health: string) {
  if (isCompletedProject) {
    return { bg: "#24a148", fg: "#ffffff" };
  }

  if (projectStage === "Tendering") {
    return { bg: "#0f62fe", fg: "#ffffff" };
  }

  if (projectStage === "Requirements") {
    return { bg: "#8a3ffc", fg: "#ffffff" };
  }

  if (projectStage === "In Progress") {
    return { bg: "#ffbf3f", fg: "#161616" };
  }

  if (health === "Red") {
    return { bg: "#da1e28", fg: "#ffffff" };
  }

  return { bg: "#697077", fg: "#ffffff" };
}

function reportPhaseColor(projectStage: string, isCompletedProject: boolean, health: string) {
  return reportPhaseTone(projectStage, isCompletedProject, health).bg;
}

function compactText(value?: string | null, fallback = "Not available", maxLength = Number.POSITIVE_INFINITY) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return fallback;
  }

  const truncated =
    Number.isFinite(maxLength) && normalized.length > maxLength
      ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
      : normalized;

  return escapeHtml(truncated);
}

function narrativeHtml(value?: string | null, fallback = "Not available", maxLength = Number.POSITIVE_INFINITY) {
  const normalized = value?.replace(/\r/g, "").trim();

  if (!normalized) {
    return `<p>${escapeHtml(fallback)}</p>`;
  }

  const bounded =
    Number.isFinite(maxLength) && normalized.length > maxLength
      ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
      : normalized;
  const blocks = bounded
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) {
    return `<p>${escapeHtml(fallback)}</p>`;
  }

  return blocks
    .map((block) => {
      const lines = block
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const bulletLines = lines.filter((line) => line.startsWith("- "));
      const headingLine = lines.length === 1 ? lines[0].replace(/:$/, "") : null;

      if (lines.length > 1 && bulletLines.length === lines.length) {
        return `<ul>${bulletLines.map((line) => `<li>${escapeHtml(line.slice(2))}</li>`).join("")}</ul>`;
      }

      if (lines.length > 1 && bulletLines.length) {
        const heading = lines.find((line) => !line.startsWith("- "));
        const items = bulletLines
          .map((line) => `<li>${escapeHtml(line.slice(2))}</li>`)
          .join("");

        return `${heading ? `<p><strong>${escapeHtml(heading)}</strong></p>` : ""}<ul>${items}</ul>`;
      }

      if (lines.length === 2 && /^[A-Z][A-Za-z ]+$/.test(lines[0].replace(/:$/, ""))) {
        return `<p><strong>${escapeHtml(lines[0].endsWith(":") ? lines[0] : `${lines[0]}:`)}</strong><br>${escapeHtml(lines[1])}</p>`;
      }

      if (headingLine && /^[A-Z][A-Za-z ]+$/.test(headingLine)) {
        return `<p><strong>${escapeHtml(lines[0].endsWith(":") ? lines[0] : `${lines[0]}:`)}</strong></p>`;
      }

      return `<p>${escapeHtml(lines.join(" "))}</p>`;
    })
    .join("");
}

function splitIntoPoints(value?: string | null, limit = 4, maxLength = 90) {
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

  const items = (primaryParts.length > 1
    ? primaryParts
    : normalizedBullets
        .split(/,\s+/)
        .map((part) => part.replace(/\s+/g, " ").replace(/^\d+[\).\s-]*/, "").trim())
        .filter(Boolean))
    .filter(Boolean)
    .slice(0, limit);

  return items.map((item) => {
    const trimmed =
      item.length > maxLength ? `${item.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : item;
    return escapeHtml(trimmed);
  });
}

function renderTag(label: string, bg: string, fg: string) {
  return `<span class="tag" style="background:${bg};color:${fg};">${escapeHtml(label)}</span>`;
}

function renderStatusDot(label: string, color: string) {
  return `
    <div class="status-dot">
      <span class="status-dot__label">${escapeHtml(label)}</span>
      <span class="status-dot__circle" style="background:${color};"></span>
    </div>
  `;
}

function formatMoney(value?: string | null, currency?: string | null) {
  if (!value) {
    return null;
  }

  const amount = Number(value);
  const code = (currency ?? "AED").trim().toUpperCase();

  if (Number.isNaN(amount)) {
    return `${code} ${value}`;
  }

  try {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;
  }
}

function formatScheduleVariance(plannedEnd?: string | null, actualEnd?: string | null) {
  if (!plannedEnd || !actualEnd) {
    return null;
  }

  const planned = new Date(plannedEnd);
  const actual = new Date(actualEnd);
  if (Number.isNaN(planned.getTime()) || Number.isNaN(actual.getTime())) {
    return null;
  }

  const days = Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return "On plan";
  }

  return days > 0 ? `${days} days delayed` : `${Math.abs(days)} days early`;
}

function costStatus(project: ProjectReportData) {
  const contractValue = project.contractValue ? Number(project.contractValue) : null;
  const actualSpend = project.actualSpendToDate ? Number(project.actualSpendToDate) : null;
  const hasContractValue = contractValue != null && !Number.isNaN(contractValue);
  const hasActualSpend = actualSpend != null && !Number.isNaN(actualSpend);

  if (!hasContractValue && !hasActualSpend) {
    return { label: "Not applicable", color: "#8d8d8d" };
  }

  if (hasContractValue && hasActualSpend) {
    return actualSpend > contractValue
      ? { label: "Over budget", color: "#da1e28" }
      : { label: "On track", color: "#24a148" };
  }

  return { label: "Tracked", color: "#0f62fe" };
}

function renderNumberedList(items: string[], fallback: string, className = "") {
  const rows = items.length === 0 ? [escapeHtml(fallback)] : items;
  return `<ol class="numbered-list ${className}">${rows.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}

function renderProgressGauge(progress: number | null) {
  if (progress == null) {
    return `
      <div class="gauge gauge--empty">
        <div class="gauge__label">Project % Complete</div>
        <div class="gauge__empty-state">Not applicable</div>
      </div>
    `;
  }

  const normalized = Math.max(0, Math.min(100, progress ?? 0));
  const dash = `${normalized} ${100 - normalized}`;

  return `
    <div class="gauge">
      <div class="gauge__label">Project % Complete</div>
      <div class="gauge__content">
        <div class="gauge__visual">
          <svg class="gauge__ring" viewBox="0 0 220 140" aria-hidden="true">
            <path
              class="gauge__track"
              pathLength="100"
              d="M 18 116 A 92 92 0 0 1 202 116"
            ></path>
            <path
              class="gauge__value"
              pathLength="100"
              stroke-dasharray="${dash}"
              d="M 18 116 A 92 92 0 0 1 202 116"
            ></path>
          </svg>
          <div class="gauge__value-text">${normalized}%</div>
        </div>
      </div>
    </div>
  `;
}

function renderSignal(health: string) {
  const active =
    health === "Red" ? "red" : health === "Amber" ? "amber" : health === "Green" ? "green" : "amber";

  return `
    <div class="signal">
      <div class="signal__label">Overall RAG Status</div>
      <div class="signal__body">
        <span class="signal__light ${active === "red" ? "signal__light--active-red" : ""}"></span>
        <span class="signal__light ${active === "amber" ? "signal__light--active-amber" : ""}"></span>
        <span class="signal__light ${active === "green" ? "signal__light--active-green" : ""}"></span>
      </div>
    </div>
  `;
}

function renderBudgetPanel(project: ProjectReportData) {
  const contractValue = formatMoney(project.contractValue, project.budgetCurrency);
  const actualSpend = formatMoney(project.actualSpendToDate, project.budgetCurrency);
  const variance = formatScheduleVariance(project.endDate, project.actualEndDate);

  if (!contractValue && !actualSpend) {
    return `
      <div class="budget-panel">
        <div class="budget-panel__label">Budget vs Spend</div>
        <div class="budget-panel__status">Not applicable</div>
      </div>
    `;
  }

  return `
    <div class="budget-panel">
      <div class="budget-panel__label">Budget vs Spend</div>
      <div class="budget-panel__metric">
        <span class="budget-panel__metric-label">Contract Value</span>
        <span class="budget-panel__metric-value">${escapeHtml(contractValue ?? "Not recorded")}</span>
      </div>
      <div class="budget-panel__metric">
        <span class="budget-panel__metric-label">Actual Spend</span>
        <span class="budget-panel__metric-value">${escapeHtml(actualSpend ?? "Not recorded")}</span>
      </div>
      <div class="budget-panel__note">
        ${escapeHtml(
          variance
            ? `Schedule variance: ${variance}.`
            : "Add planned and actual end dates to track project delay.",
        )}
      </div>
    </div>
  `;
}

function selectLatestMilestones<T extends { status: string }>(milestones: T[], limit = 8) {
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

function renderTimeline(project: ProjectReportData, progress: number | null, referenceDate: Date) {
  const projectIsComplete = project.projectStage.toLowerCase() === "completed" || progress === 100;

  const sortedMilestones = project.milestones
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return (left.dueDate ?? "").localeCompare(right.dueDate ?? "");
    });

  const markerDate = formatDisplayDate(project.lastUpdated ?? referenceDate) ?? "Current";
  const progressLabel = progress == null ? "Progress not set" : `${progress}% complete`;
  const activeLinePercent = projectIsComplete ? 100 : 0;
  const timelineMetaPrefix = projectIsComplete
    ? `Completed delivery timeline`
    : `Current: ${escapeHtml(markerDate)}`;

  const timelineMilestoneSource = selectLatestMilestones(sortedMilestones, 8);
  const axisStartPercent = 13;
  const axisWidthPercent = 74;
  const basePercents = timelineMilestoneSource.map((_, index, items) =>
    items.length === 1
      ? 50
      : axisStartPercent + index * (axisWidthPercent / Math.max(1, items.length - 1)),
  );

  const timelineMilestones = timelineMilestoneSource.map((milestone, index) => ({
    label: `M${index + 1}`,
    title: compactText(milestone.title, "Untitled milestone", 58),
    date: formatDisplayDate(milestone.dueDate) ?? "No date",
    percent: Math.max(8, Math.min(92, basePercents[index] ?? 50)),
    status: milestoneTone(milestone.status),
    statusKey: milestone.status,
    completed: milestone.status === "completed",
  }));

  const visibleMilestones =
    timelineMilestones.length > 0
      ? timelineMilestones
      : [
          {
            label: "M1",
            title: compactText(project.nextMilestone, "Current milestone", 32),
            date: formatDisplayDate(project.nextMilestoneDate) ?? "Date pending",
            percent: 50,
            status: milestoneTone("planned"),
            statusKey: "planned",
            completed: false,
          },
        ];

  return `
    <div class="timeline ${projectIsComplete ? "timeline--complete" : ""}">
      <div class="timeline__header">
        <div class="timeline__title">Program Timeline</div>
        <div class="timeline__meta">${timelineMetaPrefix} · ${escapeHtml(project.projectStage)} · ${escapeHtml(progressLabel)} · ${timelineMilestoneSource.length === project.milestones.length ? project.milestones.length : `${timelineMilestoneSource.length} shown / ${project.milestones.length}`} milestones</div>
      </div>
      <div class="timeline__indicator">
        <div class="timeline__line"></div>
        <div class="timeline__line timeline__line--active" style="${activeLinePercent > 0 ? `width:${Math.max(6, activeLinePercent)}%;` : "display:none;"}"></div>
        ${visibleMilestones
          .map(
            (milestone) => `
          <div class="timeline__milestone" style="left:${milestone.percent}%;" title="${milestone.title}">
            <span class="timeline__milestone-card">
              <span class="timeline__milestone-title">${milestone.title}</span>
            </span>
            <span class="timeline__milestone-connector"></span>
            <span class="timeline__milestone-dot timeline__milestone-dot--${milestone.statusKey}">${milestone.completed ? "✓" : milestone.label}</span>
            <span class="timeline__milestone-date">${escapeHtml(milestone.date)}</span>
          </div>
        `,
          )
          .join("")}
        <div class="timeline__steps">
          <div class="timeline__step timeline__step--complete">
            <span class="timeline__dot"></span>
            <span class="timeline__step-label">Start</span>
            <span class="timeline__step-value">${escapeHtml(formatDisplayDate(project.startDate) ?? "Not scheduled")}</span>
          </div>
          <div class="timeline__step timeline__step--future">
            <span class="timeline__dot"></span>
            <span class="timeline__step-label">Planned End</span>
            <span class="timeline__step-value">${escapeHtml(formatDisplayDate(project.endDate) ?? "Not scheduled")}</span>
          </div>
        </div>
      </div>
      <div class="timeline__legend">
        <span class="timeline__legend-item">
          <span class="timeline__legend-swatch timeline__legend-swatch--completed">✓</span>
          Completed
        </span>
        <span class="timeline__legend-item">
          <span class="timeline__legend-swatch timeline__legend-swatch--in-progress">M</span>
          In progress
        </span>
        <span class="timeline__legend-item">
          <span class="timeline__legend-swatch timeline__legend-swatch--planned">M</span>
          Planned
        </span>
        <span class="timeline__legend-item">
          <span class="timeline__legend-swatch timeline__legend-swatch--at-risk">M</span>
          At risk
        </span>
      </div>
    </div>
  `;
}

export function buildProjectStatusReportHtml(project: ProjectReportData, cadence: ReportCadence) {
  const generatedAt = new Date();
  const imkanLogoDataUri = loadImkanLogoDataUri();
  const saalLogoDataUri = loadSaalLogoDataUri();
  const progress = project.progressPercent == null ? null : deriveProgressPercent(
    project.progressPercent,
    project.currentPosition,
    project.projectStage,
  );
  const latestUpdate = project.weeklyUpdates[0] ?? null;
  const orderedMilestones = project.milestones
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return (left.dueDate ?? "").localeCompare(right.dueDate ?? "");
    });
  const orderedRisks = project.risks
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return (left.targetDate ?? "").localeCompare(right.targetDate ?? "");
    });
  const projectSponsor = project.projectSponsor?.trim() || "Not specified";
  const reportPreparedByName = "Zulfiqar Ali Soomro";
  const reportPreparedByTitle = "Technical Architect & Program Manager";
  const projectDescription =
    project.projectDescription?.trim() || "No project description has been recorded.";
  const reportDateDisplay =
    formatDisplayDate(latestUpdate?.updateDate ?? generatedAt) ?? generatedAt.toISOString().slice(0, 10);
  const reportingPeriod =
    cadence === "weekly"
      ? `Week ending ${reportDateDisplay}`
      : generatedAt.toLocaleString("en-US", { month: "long", year: "numeric" });
  const lastUpdatedDisplay = formatDisplayDate(project.lastUpdated) ?? "Not updated";
  const isCompletedProject = project.projectStage.toLowerCase() === "completed";
  const useWeeklyNarrative = cadence === "weekly";
  const currentActiveMilestoneRecord = orderedMilestones.find(
    (milestone) => milestone.status !== "completed",
  );
  const currentActiveMilestone =
    currentActiveMilestoneRecord?.title ??
    (isCompletedProject ? "Project completed" : project.nextMilestone ?? "No active milestone");
  const currentActiveMilestoneIndex = currentActiveMilestoneRecord
    ? orderedMilestones.findIndex((milestone) => milestone.id === currentActiveMilestoneRecord.id)
    : -1;
  const nextDistinctMilestone =
    currentActiveMilestoneIndex >= 0
      ? orderedMilestones
          .slice(currentActiveMilestoneIndex + 1)
          .find((milestone) => milestone.status !== "completed")
      : null;
  const nextMilestoneDisplay =
    !isCompletedProject && project.nextMilestone && project.nextMilestone !== currentActiveMilestone
      ? project.nextMilestone
      : nextDistinctMilestone?.title ?? project.nextMilestone ?? "No milestone set";
  const activeNarrativeSource = useWeeklyNarrative
    ? latestUpdate?.currentPosition ?? latestUpdate?.whatHappened ?? project.currentPosition
    : project.currentPosition ?? latestUpdate?.currentPosition ?? latestUpdate?.whatHappened;
  const activeObjectiveSource = useWeeklyNarrative
    ? latestUpdate?.nextStep ?? project.keyNextAction
    : project.keyNextAction ?? latestUpdate?.nextStep;
  const summaryText = isCompletedProject
    ? narrativeHtml(project.currentPosition, "No closure summary has been recorded.", 760)
    : narrativeHtml(
        activeNarrativeSource,
        useWeeklyNarrative
          ? "No weekly summary has been submitted yet."
          : "No monthly summary is currently available.",
      );
  const accomplishments = splitIntoPoints(
    isCompletedProject ? project.currentPosition : activeNarrativeSource,
    isCompletedProject ? 8 : 4,
    isCompletedProject ? 168 : 92,
  );
  const nextObjectives = splitIntoPoints(
    isCompletedProject ? project.keyNextAction : activeObjectiveSource,
    isCompletedProject ? 8 : 4,
    isCompletedProject ? 168 : 92,
  );
  const issuePoints = splitIntoPoints(
    latestUpdate?.blocker || latestUpdate?.helpNeeded || project.mainBlockerRisk,
    isCompletedProject ? 2 : 3,
    isCompletedProject ? 168 : 100,
  );
  const visibleMilestones = selectLatestMilestones(orderedMilestones, 8);
  const overallTone = healthTone(project.health);
  const costTone = costStatus(project);
  const phaseTone = reportPhaseColor(project.projectStage, isCompletedProject, project.health);
  const phaseTagTone = reportPhaseTone(project.projectStage, isCompletedProject, project.health);
  const scheduleTone =
    isCompletedProject ? "#24a148" : project.nextMilestoneDate == null ? "#d9d9d9" : project.health === "Red" ? "#da1e28" : project.health === "Amber" ? "#ffbf3f" : "#8cd211";
  const scheduleLabel = isCompletedProject ? "Complete" : project.nextMilestoneDate ? "Tracked" : "Open";
  const actualEndDisplay = formatDisplayDate(project.actualEndDate) ?? "Not completed";
  const scheduleVariance = formatScheduleVariance(project.endDate, project.actualEndDate);
  const milestoneRows = visibleMilestones
    .map((milestone, index) => {
      const tone = milestoneTone(milestone.status);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${compactText(milestone.title, "Untitled milestone", 88)}</td>
          <td>${escapeHtml(formatDisplayDate(milestone.dueDate) ?? "No date")}</td>
          <td>${renderTag(tone.label, tone.bg, tone.fg)}</td>
        </tr>
      `;
    })
    .join("");

  const visibleRisks = orderedRisks.slice(0, 3);
  const riskRows = visibleRisks.length
    ? visibleRisks
        .map((risk, index) => {
          const tone = riskStatusTone(risk.status);
          return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(risk.title)}</strong><br />${compactText(risk.description, "No description recorded.", 220)}</td>
          <td>${escapeHtml(risk.owner || "Not assigned")}</td>
          <td>${compactText(risk.mitigationPlan, "No mitigation plan recorded.", 180)}</td>
          <td>${renderTag(tone.label, tone.bg, tone.fg)}</td>
        </tr>
      `;
        })
        .join("")
    : issuePoints
        .map((issue, index) => {
          const action = nextObjectives[index] ?? escapeHtml("Monitor through the next governance cycle.");
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${issue}</td>
          <td>${escapeHtml(project.pendingWith || "Project team")}</td>
          <td>${action}</td>
          <td>${renderTag(project.health, overallTone.bg, overallTone.fg)}</td>
        </tr>
      `;
    })
    .join("");

  return `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(project.projectCode)} ${escapeHtml(cadence)} report</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 6mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          font-family: "IBM Plex Sans", "Segoe UI", Arial, sans-serif;
          color: #0b0f19;
          background: #f4f4f4;
        }
        .page {
          display: grid;
          gap: 4px;
        }
        .title-row {
          display: grid;
          grid-template-columns: 1.02fr 0.72fr 0.24fr 0.46fr;
          gap: 6px;
          align-items: stretch;
        }
        .title-panel {
          position: relative;
          background: #edf5ff;
          color: #161616;
          padding: 8px 10px;
          border: 1px solid #8d8d8d;
        }
        .title-panel__logo {
          position: absolute;
          top: 8px;
          right: 10px;
          width: 64px;
          height: auto;
          object-fit: contain;
        }
        .brand {
          font-size: 9.5px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #525252;
          margin-bottom: 2px;
        }
        .title {
          font-size: 14px;
          line-height: 1.1;
          margin: 0 0 1px;
          font-weight: 500;
          color: #161616;
        }
        .project-name {
          margin: 0 0 1px;
          font-size: 21px;
          line-height: 1.05;
          font-weight: 600;
          color: #161616;
        }
        .title-meta {
          margin: 0;
          display: inline-flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
          padding: 2px 6px;
          border-left: 3px solid #0f62fe;
          background: rgba(255, 255, 255, 0.78);
          font-size: 10px;
          font-weight: 600;
          color: #0b0f19;
          max-width: 720px;
        }
        .title-meta__label {
          font-weight: 700;
        }
        .title-meta__separator {
          color: #6f6f6f;
        }
        .phase-stamp {
          position: absolute;
          right: 10px;
          bottom: 8px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border: 1px solid rgba(15, 23, 40, 0.18);
          background: #ffffff;
          box-shadow: 0 1px 0 rgba(15, 23, 40, 0.08);
          color: #0b0f19;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .phase-stamp__dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          flex: 0 0 auto;
        }
        .gauge-shell {
          border: 1px solid #8d8d8d;
          padding: 11px 0 0;
          min-height: 94px;
          background: #edf5ff;
          overflow: hidden;
        }
        .gauge {
          min-height: 0;
        }
        .gauge__label {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0 8px 0;
        }
        .gauge__content {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          height: 75px;
          padding-top: 16px;
        }
        .gauge__empty-state {
          margin: 21px auto 0;
          display: inline-flex;
          padding: 5px 12px;
          background: #ffffff;
          border-left: 3px solid #0f62fe;
          color: #0b0f19;
          font-size: 13px;
          font-weight: 600;
        }
        .gauge__visual {
          position: relative;
          width: 100%;
          height: 75px;
        }
        .gauge__ring {
          width: 100%;
          height: 88px;
          transform: translateY(7px);
        }
        .gauge__track,
        .gauge__value {
          fill: none;
          stroke-width: 18;
        }
        .gauge__track {
          stroke: #d0e2ff;
        }
        .gauge__value {
          stroke: #24a148;
        }
        .gauge__value-text {
          position: absolute;
          inset: 44px 0 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 23px;
          font-weight: 600;
          color: #0b0f19;
        }
        .signal-shell {
          border: 1px solid #8d8d8d;
          padding: 5px;
          min-height: 88px;
          background: #edf5ff;
        }
        .signal__label,
        .budget-panel__label {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 3px;
        }
        .signal__body {
          width: 50px;
          margin: 0 auto;
          border-radius: 14px;
          background: #0d1726;
          padding: 8px 0;
          display: grid;
          gap: 6px;
          justify-items: center;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
        }
        .signal__light {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #314156;
          border: 1px solid #1b2838;
        }
        .signal__light--active-red {
          background: #da1e28;
        }
        .signal__light--active-amber {
          background: #ffbf3f;
        }
        .signal__light--active-green {
          background: #24a148;
        }
        .budget-shell {
          border: 1px solid #8d8d8d;
          padding: 5px 7px;
          min-height: 88px;
          background: #edf5ff;
        }
        .budget-panel__status {
          margin-top: 8px;
          display: inline-flex;
          padding: 4px 10px;
          background: #ffffff;
          border-left: 3px solid #0f62fe;
          color: #0b0f19;
          font-size: 10.5px;
          font-weight: 600;
        }
        .budget-panel__metric {
          display: grid;
          gap: 1px;
          margin-top: 6px;
        }
        .budget-panel__metric-label {
          font-size: 8px;
          font-weight: 600;
          color: #40546d;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .budget-panel__metric-value {
          font-size: 10px;
          font-weight: 600;
          color: #0b0f19;
        }
        .budget-panel__note {
          margin-top: 7px;
          max-width: 220px;
          color: #262626;
          font-size: 8.6px;
          line-height: 1.25;
        }
        .report-table,
        .grid-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .report-table {
          border: 1px solid #8d8d8d;
          background: #ffffff;
        }
        .report-table th,
        .report-table td,
        .grid-table th,
        .grid-table td {
          border: 1px solid #c6c6c6;
          padding: 2px 4px;
          vertical-align: top;
        }
        .report-table th,
        .grid-table th {
          text-align: left;
          font-size: 9px;
          font-weight: 600;
          background: #e0e0e0;
          color: #161616;
        }
        .row-value {
          font-size: 9.6px;
          line-height: 1.3;
        }
        .stacked-meta {
          display: grid;
          gap: 2px;
          align-content: start;
        }
        .stacked-meta__label {
          display: inline-block;
          width: fit-content;
          padding: 1px 3px;
          background: #f4f4f4;
          border-left: 2px solid #0f62fe;
          font-size: 9.2px;
          font-weight: 700;
          color: #0b0f19;
        }
        .stacked-meta__value {
          font-size: 9.4px;
          font-weight: 400;
          line-height: 1.25;
          color: #0b0f19;
        }
        .stacked-meta__value--about {
          display: block;
          min-height: 10px;
          font-size: 8.2px;
          line-height: 1.06;
        }
        .stacked-meta__subvalue {
          font-size: 8px;
          line-height: 1.2;
          color: #525252;
        }
        .tag {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          border: 1px solid rgba(15, 23, 40, 0.12);
        }
        .status-dot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .status-dot__label {
          font-size: 10.8px;
          font-weight: 400;
          line-height: 1.2;
          color: #0b0f19;
        }
        .status-dot__circle {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 1px solid #314156;
          flex: 0 0 auto;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);
        }
        .section-box {
          border: 1px solid #8d8d8d;
          background: #ffffff;
        }
        .section-box__title {
          padding: 2px 6px;
          border-bottom: 1px solid #c6c6c6;
          font-size: 9px;
          font-weight: 600;
          background: #e0e0e0;
          color: #161616;
          letter-spacing: 0.04em;
        }
        .section-box__body {
          padding: 4px 5px;
        }
        .section-box__body .grid-table thead tr:first-child th {
          border-top: 0;
        }
        .section-box__body .grid-table tr > *:first-child {
          border-left: 0;
        }
        .section-box__body .grid-table tr > *:last-child {
          border-right: 0;
        }
        .section-box__body .grid-table tbody tr:last-child td {
          border-bottom: 0;
        }
        .timeline {
          border: 1px solid #8d8d8d;
          background: #ffffff;
          padding: 4px 6px 5px;
        }
        .timeline__header {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 4px;
          padding: 3px 5px;
          background: #e0e0e0;
          border: 1px solid #c6c6c6;
        }
        .timeline__title {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .timeline__meta {
          font-size: 8.8px;
          color: #40546d;
        }
        .timeline__indicator {
          position: relative;
          padding-top: 4px;
          min-height: 108px;
        }
        .timeline__line {
          position: absolute;
          top: 50px;
          left: 34px;
          right: 34px;
          height: 2px;
          background: #78c7dc;
        }
        .timeline__line--active {
          right: auto;
          max-width: calc(100% - 56px);
          background: #0f62fe;
        }
        .timeline--complete .timeline__line--active {
          background: #24a148;
        }
        .timeline__steps {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-top: 51px;
          padding-left: 10px;
          padding-right: 10px;
        }
        .timeline__step {
          position: relative;
          display: grid;
          gap: 4px;
          width: 84px;
        }
        .timeline__step--complete {
          padding-top: 0;
        }
        .timeline__step--future {
          text-align: right;
          padding-top: 0;
          margin-right: 2px;
        }
        .timeline__dot {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 2px solid #697b8c;
          justify-self: start;
        }
        .timeline__step--complete .timeline__dot {
          background: #0f62fe;
          border-color: #0f62fe;
        }
        .timeline__step--future .timeline__dot {
          justify-self: end;
        }
        .timeline--complete .timeline__step--future .timeline__dot {
          background: #24a148;
          border-color: #1e8d3d;
        }
        .timeline__step-label {
          font-size: 7px;
          font-weight: 600;
          text-transform: uppercase;
          color: #40546d;
          line-height: 1.1;
          background: #ffffff;
          padding-top: 4px;
        }
        .timeline__step-value {
          font-size: 8.8px;
          line-height: 1.2;
          font-weight: 600;
          color: #0b0f19;
          background: #ffffff;
        }
        .timeline__milestone {
          position: absolute;
          width: 118px;
          height: 98px;
          transform: translateX(-50%);
        }
        .timeline__milestone-card {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          min-height: 30px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: #ffffff;
          padding: 0 3px 2px;
          text-align: center;
        }
        .timeline__milestone-connector {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          background: #8aa0b8;
          top: 31px;
          height: 9px;
        }
        .timeline__milestone-dot {
          position: absolute;
          top: 38px;
          left: 50%;
          transform: translateX(-50%);
          width: 31px;
          height: 24px;
          border-radius: 2px;
          border: 1px solid rgba(15, 23, 40, 0.24);
          box-shadow: 0 0 0 2px rgba(255,255,255,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9.5px;
          font-weight: 700;
          line-height: 1;
        }
        .timeline__milestone-dot--completed {
          border-radius: 2px;
          background: #24a148 !important;
          color: #ffffff !important;
          border-color: #1e8d3d;
        }
        .timeline__milestone-dot--at_risk {
          background: #da1e28;
          color: #ffffff;
          border-color: #a2191f;
        }
        .timeline__milestone-dot--in_progress {
          background: #0f62fe;
          color: #ffffff;
          border-color: #0043ce;
        }
        .timeline__milestone-dot--planned {
          background: #ffffff;
          color: #0f62fe;
          border: 2px solid #0f62fe;
        }
        .timeline__milestone-title {
          font-size: 6.5px;
          font-weight: 600;
          line-height: 1.08;
          color: #0b0f19;
        }
        .timeline__milestone-date {
          position: absolute;
          left: 0;
          right: 0;
          top: 66px;
          background: #ffffff;
          text-align: center;
          font-size: 5.7px;
          color: #40546d;
          line-height: 1.1;
        }
        .timeline__legend {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 2px;
          padding-top: 2px;
          border-top: 1px solid #dde1e6;
        }
        .timeline__legend-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 7.2px;
          line-height: 1;
          color: #40546d;
          white-space: nowrap;
        }
        .timeline__legend-swatch {
          width: 14px;
          height: 11px;
          border-radius: 2px;
          border: 1px solid rgba(15, 23, 40, 0.24);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 7px;
          font-weight: 700;
        }
        .timeline__legend-swatch--completed {
          background: #24a148;
          color: #ffffff;
          border-color: #1e8d3d;
        }
        .timeline__legend-swatch--in-progress {
          background: #0f62fe;
          color: #ffffff;
          border-color: #0043ce;
        }
        .timeline__legend-swatch--planned {
          background: #ffffff;
          color: #0f62fe;
          border: 2px solid #0f62fe;
        }
        .timeline__legend-swatch--at-risk {
          background: #da1e28;
          color: #ffffff;
          border-color: #a2191f;
        }
        .summary-text {
          min-height: 56px;
          font-size: 9.4px;
          line-height: 1.22;
          color: #0b0f19;
        }
        .summary-text p {
          margin: 0 0 5px;
        }
        .summary-text p:last-child,
        .summary-text ul:last-child {
          margin-bottom: 0;
        }
        .summary-text ul {
          margin: 2px 0 6px 12px;
          padding: 0;
        }
        .summary-text li {
          margin: 0 0 3px;
        }
        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .numbered-list {
          margin: 0;
          padding-left: 18px;
          min-height: 48px;
          font-size: 8.9px;
          line-height: 1.2;
          color: #0b0f19;
        }
        .numbered-list--compact {
          column-count: 2;
          column-gap: 14px;
          min-height: 0;
          padding-left: 13px;
          font-size: 7.6px;
          line-height: 1.08;
        }
        .numbered-list--compact li {
          break-inside: avoid;
          margin-bottom: 1px;
        }
        .numbered-list li {
          margin-bottom: 2px;
        }
        .numbered-list li:last-child {
          margin-bottom: 0;
        }
        .grid-table th,
        .grid-table td {
          font-size: 8.4px;
          vertical-align: top;
          color: #0b0f19;
        }
        .risk-table th,
        .risk-table td {
          font-size: 8.1px;
          line-height: 1.12;
        }
        .risk-table .tag {
          padding: 2px 5px;
          border-radius: 3px;
          font-size: 7.3px;
          line-height: 1;
        }
        .milestone-table th,
        .milestone-table td {
          padding: 1px 4px;
          font-size: 7.6px;
          line-height: 1.06;
        }
        .milestone-table .tag {
          padding: 2px 5px;
          border-radius: 3px;
          font-size: 7.2px;
        }
        .milestone-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 6px;
          padding: 5px 6px;
        }
        .milestone-list__item {
          display: grid;
          grid-template-columns: 21px 1fr;
          gap: 5px;
          align-items: start;
          min-height: 22px;
        }
        .milestone-list__index {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 18px;
          background: #dce7f1;
          border: 1px solid #9fb4c9;
          font-size: 7.6px;
          font-weight: 700;
        }
        .milestone-list__content {
          display: grid;
          gap: 2px;
        }
        .milestone-list__title {
          font-size: 7.5px;
          line-height: 1.12;
          font-weight: 600;
        }
        .milestone-list__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
          font-size: 7px;
          color: #40546d;
        }
        .milestone-list .tag {
          padding: 2px 6px;
          font-size: 7.5px;
          border-radius: 3px;
        }
        .report-footer {
          position: fixed;
          right: 6mm;
          bottom: 3mm;
          display: flex;
          align-items: center;
          gap: 4px;
          color: #6f6f6f;
          font-size: 6.4px;
          letter-spacing: 0.04em;
        }
        .report-footer__logo {
          width: 34px;
          height: auto;
          object-fit: contain;
        }
      </style>
    </head>
    <body>
      <main class="page">
        <section class="title-row">
          <div class="title-panel">
            ${imkanLogoDataUri ? `<img class="title-panel__logo" src="${imkanLogoDataUri}" alt="IMKAN logo" />` : ""}
            <div class="brand">IMKAN Digital Transformation Portfolio</div>
            <h1 class="title">Project Status Report</h1>
            <h2 class="project-name">${escapeHtml(project.projectCode)} - ${escapeHtml(project.projectName)}</h2>
            <p class="title-meta">
              <span class="title-meta__label">Reporting period:</span>
              <span>${escapeHtml(reportingPeriod)}</span>
              <span class="title-meta__separator">·</span>
              <span class="title-meta__label">Last updated:</span>
              <span>${escapeHtml(lastUpdatedDisplay)}</span>
            </p>
            <div class="phase-stamp">
              <span class="phase-stamp__dot" style="background:${phaseTone};"></span>
              ${escapeHtml(project.projectStage)}
            </div>
          </div>
          <div class="gauge-shell">
            ${renderProgressGauge(progress)}
          </div>
          <div class="signal-shell">
            ${renderSignal(project.health)}
          </div>
          <div class="budget-shell">
            ${renderBudgetPanel(project)}
          </div>
        </section>

        <section>
          <table class="report-table">
            <colgroup>
              <col style="width:38%" />
              <col style="width:16%" />
              <col style="width:16%" />
              <col style="width:15%" />
              <col style="width:15%" />
            </colgroup>
            <tr>
              <th>Project Health Indicator</th>
              <th>Overall Status</th>
              <th>Cost</th>
              <th>Schedule</th>
              <th>Client/Project Owner</th>
            </tr>
            <tr>
              <td>
                <div class="stacked-meta">
                  <div class="stacked-meta__label">Project Name</div>
                  <div class="stacked-meta__value">${escapeHtml(project.projectName)}</div>
                </div>
              </td>
              <td>${renderStatusDot(project.health, overallTone.bg)}</td>
              <td>${renderStatusDot(costTone.label, costTone.color)}</td>
              <td>${renderStatusDot(scheduleLabel, scheduleTone)}</td>
              <td>
                <div class="stacked-meta">
                  <div class="stacked-meta__value">${escapeHtml(projectSponsor)}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="stacked-meta">
                  <div class="stacked-meta__label">About the Project</div>
                  <div class="stacked-meta__value stacked-meta__value--about">${escapeHtml(projectDescription)}</div>
                </div>
              </td>
              <td>
                <div class="stacked-meta">
                  <div class="stacked-meta__label">Project Manager</div>
                  <div class="stacked-meta__value">${escapeHtml(project.pmName || "Not assigned")}</div>
                </div>
              </td>
              <td>
                <div class="stacked-meta">
                  <div class="stacked-meta__label">Report Prepared By</div>
                  <div class="stacked-meta__value">
                    ${escapeHtml(reportPreparedByName)}<br />
                    ${escapeHtml(reportPreparedByTitle)}
                  </div>
                </div>
              </td>
              <td>
                <div class="stacked-meta">
                  <div class="stacked-meta__label">Current Phase</div>
                  <div class="stacked-meta__value">${renderTag(reportPhaseLabel(project.projectStage), phaseTagTone.bg, phaseTagTone.fg)}</div>
                </div>
              </td>
              <td>
                <div class="stacked-meta">
                  <div class="stacked-meta__label">${escapeHtml(isCompletedProject ? "Actual End Date" : "Next Milestone")}</div>
                  <div class="stacked-meta__value">${escapeHtml(
                    isCompletedProject
                      ? actualEndDisplay
                      : nextMilestoneDisplay,
                  )}</div>
                  ${
                    isCompletedProject && scheduleVariance
                      ? `<div class="stacked-meta__subvalue">${escapeHtml(scheduleVariance)}</div>`
                      : ""
                  }
                </div>
              </td>
            </tr>
          </table>
        </section>

        <section>
          ${renderTimeline(project, progress, generatedAt)}
        </section>

        <section class="section-box">
          <div class="section-box__title">Executive Summary Progress Update</div>
          <div class="section-box__body summary-text">${summaryText}</div>
        </section>

        <section class="two-col">
          <div class="section-box">
            <div class="section-box__title">${escapeHtml(isCompletedProject ? "Completed Activities" : "Accomplishments This Period")}</div>
            <div class="section-box__body">
              ${renderNumberedList(accomplishments, isCompletedProject ? "No completed activities have been recorded." : "No accomplishment note has been submitted.", isCompletedProject ? "numbered-list--compact" : "")}
            </div>
          </div>
          <div class="section-box">
            <div class="section-box__title">${escapeHtml(
              isCompletedProject ? "Completed Deliverables" : cadence === "weekly" ? "Objectives Next Period" : "Next Period Objectives",
            )}</div>
            <div class="section-box__body">
              ${renderNumberedList(nextObjectives, isCompletedProject ? "No completed deliverables have been recorded." : "No next-period objective has been recorded.", isCompletedProject ? "numbered-list--compact" : "")}
            </div>
          </div>
        </section>

        <section class="two-col">
          <div class="section-box">
            <div class="section-box__title">Top Risks / Issues</div>
            <div class="section-box__body" style="padding:0;">
              <table class="grid-table risk-table">
                <colgroup>
                  <col style="width:6%" />
                  <col style="width:40%" />
                  <col style="width:16%" />
                  <col style="width:26%" />
                  <col style="width:12%" />
                </colgroup>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Risk / Issue Description</th>
                    <th>Owner</th>
                    <th>Mitigation / Action Plan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    riskRows ||
                    `<tr><td>1</td><td>${compactText(
                      latestUpdate?.blocker || latestUpdate?.helpNeeded || project.mainBlockerRisk,
                      "No material issue or risk is currently logged.",
                      isCompletedProject ? 210 : 140,
                    )}</td><td>${escapeHtml(project.pendingWith || "Project team")}</td><td>${compactText(
                      isCompletedProject &&
                        /no active risks?|no active issues?|no active delivery blocker|no material issue|none\b/i.test(
                          latestUpdate?.blocker || latestUpdate?.helpNeeded || project.mainBlockerRisk || "",
                        )
                        ? "No mitigation required. Project closed successfully."
                        : latestUpdate?.nextStep ?? project.keyNextAction,
                      "Monitor through the next governance cycle.",
                      isCompletedProject ? 180 : 100,
                    )}</td><td>${renderTag(project.health, overallTone.bg, overallTone.fg)}</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="section-box">
            <div class="section-box__title">Milestones</div>
            <div class="section-box__body" style="padding:0;">
              <table class="grid-table milestone-table">
                <colgroup>
                  <col style="width:7%" />
                  <col style="width:58%" />
                  <col style="width:20%" />
                  <col style="width:15%" />
                </colgroup>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Milestone Title</th>
                    <th>Target Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    milestoneRows ||
                    `<tr><td>1</td><td>${escapeHtml(project.nextMilestone || "No milestones recorded")}</td><td>${escapeHtml(
                      formatDisplayDate(project.nextMilestoneDate) ?? "No date",
                    )}</td><td>${renderTag("Open", "#d9d9d9", "#161616")}</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      ${
        saalLogoDataUri
          ? `<footer class="report-footer"><span>Prepared by</span><img class="report-footer__logo" src="${saalLogoDataUri}" alt="SAAL logo" /></footer>`
          : ""
      }
    </body>
  </html>
  `;
}
