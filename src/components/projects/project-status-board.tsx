"use client";

import { useEffect, useState } from "react";
import { Calendar, Flag, Time, UserAvatar, WarningAltFilled } from "@carbon/icons-react";
import { Button, ClickableTile, InlineNotification, Select, SelectItem, Tag, Tile } from "@carbon/react";

import { AppBreadcrumbs } from "@/components/navigation/app-breadcrumbs";
import { deriveProgressPercent, formatDisplayDate } from "@/lib/utils/format";

import styles from "./project-status-board.module.scss";

type ProjectRecord = {
  id: string;
  projectCode: string;
  projectName: string;
  projectDescription?: string | null;
  projectSponsor?: string | null;
  projectStage: string;
  progressPercent?: number | null;
  health: string;
  currentPosition?: string | null;
  keyNextAction?: string | null;
  mainBlockerRisk?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  actualEndDate?: string | null;
  budgetCurrency?: string | null;
  contractValue?: string | null;
  lastUpdated?: string | null;
};

type HealthKey = "green" | "amber" | "red" | "grey";
type StageKey = "completed" | "in-progress" | "tendering" | "not-started" | "default";
type BudgetFilter = "all" | "recorded" | "missing" | "under-1m" | "1m-10m" | "10m-plus";

const HEALTH_DETAILS: Record<HealthKey, { label: string; color: string }> = {
  green: { label: "Green", color: "#24a148" },
  amber: { label: "Amber", color: "#f1c21b" },
  red: { label: "Red", color: "#da1e28" },
  grey: { label: "Grey", color: "#8d8d8d" },
};

function healthKey(health: string): HealthKey {
  switch (health.trim().toLowerCase()) {
    case "red":
      return "red";
    case "amber":
      return "amber";
    case "green":
      return "green";
    default:
      return "grey";
  }
}

function healthTagClassName(health: HealthKey) {
  return {
    green: styles.healthTagGreen,
    amber: styles.healthTagAmber,
    red: styles.healthTagRed,
    grey: styles.healthTagGrey,
  }[health];
}

function healthCardClassName(health: HealthKey) {
  return {
    green: styles.healthGreen,
    amber: styles.healthAmber,
    red: styles.healthRed,
    grey: styles.healthGrey,
  }[health];
}

function stageKey(stage: string): StageKey {
  switch (stage.trim().toLowerCase()) {
    case "completed":
      return "completed";
    case "in progress":
      return "in-progress";
    case "tendering":
      return "tendering";
    case "not started":
    case "on hold":
      return "not-started";
    default:
      return "default";
  }
}

function stageTagClassName(stage: StageKey) {
  return {
    completed: styles.stageTagCompleted,
    "in-progress": styles.stageTagInProgress,
    tendering: styles.stageTagTendering,
    "not-started": styles.stageTagNotStarted,
    default: styles.stageTagDefault,
  }[stage];
}

function managementFocus(project: ProjectRecord) {
  return (
    project.mainBlockerRisk?.trim() ||
    project.keyNextAction?.trim() ||
    "No active blocker or next action is recorded."
  );
}

function formatBudget(value?: string | null, currency?: string | null) {
  if (!value) {
    return "Not set";
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
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString("en-AE", { maximumFractionDigits: 0 })}`;
  }
}

function matchesBudgetFilter(project: ProjectRecord, filter: BudgetFilter) {
  const hasBudget = project.contractValue != null && project.contractValue.trim() !== "";

  if (filter === "all") {
    return true;
  }

  if (filter === "recorded") {
    return hasBudget;
  }

  if (filter === "missing") {
    return !hasBudget;
  }

  if (!hasBudget) {
    return false;
  }

  const amount = Number(project.contractValue);

  if (Number.isNaN(amount)) {
    return false;
  }

  if (filter === "under-1m") {
    return amount < 1_000_000;
  }

  if (filter === "1m-10m") {
    return amount >= 1_000_000 && amount < 10_000_000;
  }

  return amount >= 10_000_000;
}

function HealthPieChart({ projects }: { projects: ProjectRecord[] }) {
  const healthCounts = projects.reduce<Record<HealthKey, number>>(
    (counts, project) => {
      counts[healthKey(project.health)] += 1;
      return counts;
    },
    { green: 0, amber: 0, red: 0, grey: 0 },
  );
  const totalProjects = projects.length;
  const stageCounts = projects.reduce<Record<string, number>>((counts, project) => {
    const stage = project.projectStage.trim().toLowerCase();
    counts[stage] = (counts[stage] ?? 0) + 1;
    return counts;
  }, {});
  const completedProjects = stageCounts.completed ?? 0;
  const inProgressProjects = stageCounts["in progress"] ?? 0;
  const notStartedProjects = stageCounts["not started"] ?? 0;
  const onHoldProjects = stageCounts["on hold"] ?? 0;
  const tenderingProjects = stageCounts.tendering ?? 0;
  const otherProjects = Math.max(
    0,
    totalProjects - completedProjects - inProgressProjects - notStartedProjects - onHoldProjects - tenderingProjects,
  );
  const stageMetrics = [
    { label: "Total projects", value: totalProjects },
    { label: "Completed", value: completedProjects },
    { label: "In progress", value: inProgressProjects },
    { label: "Not started", value: notStartedProjects },
    { label: "On hold", value: onHoldProjects },
    { label: "Tendering", value: tenderingProjects },
    { label: "Other", value: otherProjects },
  ];
  let offset = 0;

  return (
    <Tile className={styles.summaryTile}>
      <div className={styles.chartWrap}>
        <svg className={styles.pieChart} viewBox="0 0 42 42" role="img" aria-label={`Health distribution for ${totalProjects} projects`}>
          <circle className={styles.pieTrack} cx="21" cy="21" r="15.9155" />
          {Object.entries(HEALTH_DETAILS).map(([key, detail]) => {
            const count = healthCounts[key as HealthKey];
            const share = totalProjects ? (count / totalProjects) * 100 : 0;
            const segment = (
              <circle
                key={key}
                className={styles.pieSegment}
                cx="21"
                cy="21"
                r="15.9155"
                pathLength="100"
                stroke={detail.color}
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 21 21)"
              />
            );
            offset += share;
            return segment;
          })}
          <text className={styles.pieCenterValue} x="21" y="20">{totalProjects}</text>
          <text className={styles.pieCenterLabel} x="21" y="23.5">projects</text>
        </svg>
      </div>
      <div className={styles.summaryContent}>
        <p className={styles.eyebrow}>Portfolio health</p>
        <h2 className={styles.summaryTitle}>Delivery health distribution</h2>
        <p className={styles.summaryText}>A quick view of where leadership attention is needed across the portfolio.</p>
        <ul className={styles.healthLegend} aria-label="Project health totals">
          {(Object.keys(HEALTH_DETAILS) as HealthKey[]).map((key) => (
            <li key={key}>
              <Tag className={healthTagClassName(key)} size="sm">
                {HEALTH_DETAILS[key].label} {healthCounts[key]}
              </Tag>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.stageMetrics} aria-label="Project stage totals">
        {stageMetrics.map((metric) => (
          <div className={styles.stageMetric} key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function ProjectProgressRing({ projectName, progress }: { projectName: string; progress: number }) {
  return (
    <div className={styles.progressRingWrap}>
      <svg
        className={styles.progressRing}
        viewBox="0 0 42 42"
        role="img"
        aria-label={`${projectName} is ${progress}% complete`}
      >
        <circle className={styles.progressRingTrack} cx="21" cy="21" r="15.9155" />
        <circle
          className={styles.progressRingValue}
          cx="21"
          cy="21"
          r="15.9155"
          pathLength="100"
          strokeDasharray={`${progress} ${100 - progress}`}
          transform="rotate(-90 21 21)"
        />
        <text className={styles.progressRingNumber} x="21" y="20">{progress}%</text>
        <text className={styles.progressRingLabel} x="21" y="23.5">complete</text>
      </svg>
    </div>
  );
}

function ProjectStatusCard({ project }: { project: ProjectRecord }) {
  const progress = deriveProgressPercent(project.progressPercent, project.currentPosition, project.projectStage) ?? 0;
  const health = healthKey(project.health);
  const projectBudget = formatBudget(project.contractValue, project.budgetCurrency);

  return (
    <ClickableTile
      href={`/projects/${project.id}`}
      className={`${styles.projectCard} ${healthCardClassName(health)}`}
      aria-label={`Open ${project.projectName}`}
    >
      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <div className={styles.cardMetaRow}>
              <p className={styles.projectCode}>{project.projectCode}</p>
              <p className={styles.lastUpdated}>
                <Time size={14} aria-hidden="true" />
                {formatDisplayDate(project.lastUpdated) ?? "No update date"}
              </p>
            </div>
            <h2 className={styles.projectName}>{project.projectName}</h2>
            <p className={styles.projectDescription}>
              {project.projectDescription?.trim() || "No project description is recorded."}
            </p>
          </div>
          <div className={styles.healthSignal}>
            <p className={styles.fieldLabel}>Health</p>
            <Tag className={healthTagClassName(health)} size="sm">
              {HEALTH_DETAILS[health].label}
            </Tag>
          </div>
        </div>

        <div className={styles.projectSnapshot}>
          <ProjectProgressRing projectName={project.projectName} progress={progress} />
          <div className={styles.deliverySummary}>
            <div className={styles.deliveryBadgeGroup}>
              <p className={styles.fieldLabel}>Current stage</p>
              <Tag className={stageTagClassName(stageKey(project.projectStage))} size="sm">
                {project.projectStage || "Not set"}
              </Tag>
            </div>
            <div className={styles.deliveryBadgeGroup}>
              <p className={styles.fieldLabel}>Budget</p>
              <p className={styles.budgetValue} title={projectBudget}>{projectBudget}</p>
            </div>
          </div>
        </div>

        <div className={styles.factsGrid} aria-label="Project facts">
          <div className={styles.factItem}>
            <UserAvatar size={18} aria-hidden="true" />
            <div>
              <p className={styles.fieldLabel}>Business owner</p>
              <p className={`${styles.factValue} ${styles.businessOwner}`}>
                {project.projectSponsor?.trim() || "Not specified"}
              </p>
            </div>
          </div>
          <div className={styles.factItem}>
            <Calendar size={18} aria-hidden="true" />
            <div>
              <p className={styles.fieldLabel}>Project start</p>
              <p className={styles.factValue}>{formatDisplayDate(project.startDate) ?? "Not set"}</p>
            </div>
          </div>
          <div className={styles.factItem}>
            <Flag size={18} aria-hidden="true" />
            <div>
              <p className={styles.fieldLabel}>Expected end</p>
              <p className={styles.factValue}>{formatDisplayDate(project.endDate) ?? "Not scheduled"}</p>
            </div>
          </div>
        </div>

        <div className={styles.managementGrid}>
          <div className={styles.managementItem}>
            <WarningAltFilled size={18} aria-hidden="true" />
            <div>
              <p className={styles.fieldLabel}>Management update</p>
              <p className={styles.managementValue}>{managementFocus(project)}</p>
            </div>
          </div>
        </div>
      </div>
    </ClickableTile>
  );
}

export function ProjectStatusBoard() {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("all");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/projects", { cache: "no-store", signal: controller.signal });

        if (!response.ok) {
          throw new Error("Project status could not be loaded.");
        }

        const result = (await response.json()) as { projects?: ProjectRecord[] };

        if (active) {
          setProjects(result.projects ?? []);
        }
      } catch (fetchError) {
        if (active && fetchError instanceof Error && fetchError.name !== "AbortError") {
          setError(fetchError.message);
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const projectList = projects ?? [];
  const stageOptions = [...new Set(projectList.map((project) => project.projectStage).filter(Boolean))].sort();
  const ownerOptions = [
    ...new Set(projectList.map((project) => project.projectSponsor?.trim() || "__missing__")),
  ].sort((left, right) => {
    if (left === "__missing__") return 1;
    if (right === "__missing__") return -1;
    return left.localeCompare(right);
  });
  const filteredProjects = projectList.filter((project) => {
    const owner = project.projectSponsor?.trim() || "__missing__";
    const matchesStage = stageFilter === "all" || project.projectStage === stageFilter;
    const matchesOwner = ownerFilter === "all" || owner === ownerFilter;
    const matchesHealth = healthFilter === "all" || healthKey(project.health) === healthFilter;

    return matchesStage && matchesOwner && matchesHealth && matchesBudgetFilter(project, budgetFilter);
  });
  const hasActiveFilters =
    stageFilter !== "all" || ownerFilter !== "all" || healthFilter !== "all" || budgetFilter !== "all";

  function clearFilters() {
    setStageFilter("all");
    setOwnerFilter("all");
    setHealthFilter("all");
    setBudgetFilter("all");
  }

  return (
    <div className={styles.board}>
      <AppBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Project status" },
        ]}
      />

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Management overview</p>
        <h1 className={styles.title}>Project status at a glance</h1>
        <p className={styles.subtitle}>
          A one-page view of project purpose, stage, health, progress, schedule, and management updates.
        </p>
      </section>

      <section className={styles.filterBar} aria-label="Project status filters">
        <Select
          id="status-filter-stage"
          labelText="Current stage"
          size="sm"
          value={stageFilter}
          disabled={!projects}
          onChange={(event) => setStageFilter(event.target.value)}
        >
          <SelectItem value="all" text="All stages" />
          {stageOptions.map((stage) => (
            <SelectItem key={stage} value={stage} text={stage} />
          ))}
        </Select>
        <Select
          id="status-filter-owner"
          labelText="Business owner"
          size="sm"
          value={ownerFilter}
          disabled={!projects}
          onChange={(event) => setOwnerFilter(event.target.value)}
        >
          <SelectItem value="all" text="All owners" />
          {ownerOptions.map((owner) => (
            <SelectItem
              key={owner}
              value={owner}
              text={owner === "__missing__" ? "Not specified" : owner}
            />
          ))}
        </Select>
        <Select
          id="status-filter-health"
          labelText="Health"
          size="sm"
          value={healthFilter}
          disabled={!projects}
          onChange={(event) => setHealthFilter(event.target.value)}
        >
          <SelectItem value="all" text="All health" />
          {(Object.keys(HEALTH_DETAILS) as HealthKey[]).map((key) => (
            <SelectItem key={key} value={key} text={HEALTH_DETAILS[key].label} />
          ))}
        </Select>
        <Select
          id="status-filter-budget"
          labelText="Budget"
          size="sm"
          value={budgetFilter}
          disabled={!projects}
          onChange={(event) => setBudgetFilter(event.target.value as BudgetFilter)}
        >
          <SelectItem value="all" text="All budgets" />
          <SelectItem value="recorded" text="Budget recorded" />
          <SelectItem value="missing" text="No budget" />
          <SelectItem value="under-1m" text="Under 1 million" />
          <SelectItem value="1m-10m" text="1–10 million" />
          <SelectItem value="10m-plus" text="10 million+" />
        </Select>
        <div className={styles.filterActions}>
          <p className={styles.filterResult}>
            {projects ? `${filteredProjects.length} of ${projects.length} projects` : "Loading projects"}
          </p>
          <Button kind="tertiary" size="sm" disabled={!hasActiveFilters} onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      </section>

      {error ? (
        <InlineNotification kind="error" title="Project status could not load" subtitle={error} lowContrast />
      ) : projects === null ? (
        <div className={styles.projectGrid} aria-label="Loading project status cards">
          {Array.from({ length: 10 }, (_, index) => (
            <Tile key={index} className={styles.projectCard} aria-hidden="true" />
          ))}
        </div>
      ) : projects.length ? (
        <>
          <HealthPieChart projects={filteredProjects} />
          {filteredProjects.length ? (
            <section className={styles.projectGrid} aria-label="Project status cards">
              {filteredProjects.map((project) => (
                <ProjectStatusCard key={project.id} project={project} />
              ))}
            </section>
          ) : (
            <Tile>
              <p>No projects match the selected filters.</p>
            </Tile>
          )}
        </>
      ) : (
        <Tile>
          <p>No projects are currently available in your portfolio.</p>
        </Tile>
      )}
    </div>
  );
}
