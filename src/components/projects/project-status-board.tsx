"use client";

import { useEffect, useState } from "react";
import {
  DonutChart,
  GaugeChart,
  type DonutChartOptions,
  type GaugeChartOptions,
} from "@carbon/charts-react";
import { ArrowRight, CheckmarkFilled, Time, WarningAltFilled } from "@carbon/icons-react";
import {
  Accordion,
  AccordionItem,
  Button,
  ClickableTile,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  Tag,
  Tile,
} from "@carbon/react";

import { AppBreadcrumbs } from "@/components/navigation/app-breadcrumbs";
import { deriveProgressPercent, formatCompactDate } from "@/lib/utils/format";

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
  managementUpdate?: string | null;
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
type ProjectGroupKey = "in-progress" | "completed" | "tendering" | "not-started";
type CarbonTagType = "red" | "purple" | "blue" | "green" | "gray" | "cool-gray" | "warm-gray";
type VendorIdentity = {
  name: string;
  imageClassName: string;
};

const PROJECT_GROUPS: Array<{ key: ProjectGroupKey; label: string }> = [
  { key: "in-progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "tendering", label: "In Tendering or Requirements" },
  { key: "not-started", label: "Not Started" },
];

const HEALTH_DETAILS: Record<HealthKey, { label: string; chartColor: string }> = {
  green: { label: "Green", chartColor: "var(--cds-support-success)" },
  amber: { label: "Amber", chartColor: "var(--cds-support-warning)" },
  red: { label: "Red", chartColor: "var(--cds-support-error)" },
  grey: { label: "Grey", chartColor: "var(--cds-icon-secondary)" },
};

const PROJECT_GAUGE_OPTIONS: GaugeChartOptions = {
  accessibility: {
    svgAriaLabel: "Delivery progress",
  },
  animations: true,
  color: {
    scale: {
      value: "var(--cds-link-primary)",
    },
  },
  gauge: {
    alignment: "center",
    arcWidth: 7,
    deltaArrow: {
      enabled: false,
    },
    showPercentageSymbol: true,
    type: "full",
    valueFontSize: () => 18,
  },
  height: "4.5rem",
  resizable: false,
  toolbar: {
    enabled: false,
  },
  tooltip: {
    enabled: false,
  },
  width: "4.5rem",
};

const SOFTWARE_VENDORS: Array<{
  terms: string[];
  vendor: VendorIdentity;
}> = [
  {
    terms: ["community management", "anacity"],
    vendor: { name: "Anacity", imageClassName: styles.vendorAnacity },
  },
  { terms: ["jaggaer"], vendor: { name: "JAGGAER", imageClassName: styles.vendorJaggaer } },
  { terms: ["salesforce"], vendor: { name: "Salesforce", imageClassName: styles.vendorSalesforce } },
  { terms: ["docusign"], vendor: { name: "DocuSign", imageClassName: styles.vendorDocusign } },
  { terms: ["oracle fusion", "oracle cloud", "oracle erp"], vendor: { name: "Oracle", imageClassName: styles.vendorOracle } },
  { terms: ["yardi"], vendor: { name: "Yardi", imageClassName: styles.vendorYardi } },
  { terms: ["arcgis", "esri"], vendor: { name: "Esri ArcGIS", imageClassName: styles.vendorEsri } },
  { terms: ["argus estate", "argus enterprise"], vendor: { name: "ARGUS", imageClassName: styles.vendorArgus } },
  { terms: ["navisworks", "autodesk"], vendor: { name: "Autodesk", imageClassName: styles.vendorAutodesk } },
  { terms: ["finereport"], vendor: { name: "FineReport", imageClassName: styles.vendorFineReport } },
  { terms: ["smartfm", "nanosoft"], vendor: { name: "Nanosoft", imageClassName: styles.vendorNanosoft } },
  { terms: ["digixt"], vendor: { name: "DigiXT", imageClassName: styles.vendorDigixt } },
  { terms: ["zelo"], vendor: { name: "Zelo", imageClassName: styles.vendorZelo } },
];

function inferSoftwareVendor(project: ProjectRecord) {
  const projectName = project.projectName.toLowerCase();
  const description = (project.projectDescription ?? "").toLowerCase();
  const nameMatch = SOFTWARE_VENDORS.find(({ terms }) => terms.some((term) => projectName.includes(term)));

  if (nameMatch) {
    return nameMatch.vendor;
  }

  return SOFTWARE_VENDORS.find(({ terms }) => terms.some((term) => description.includes(term)))?.vendor ?? null;
}

function VendorMark({ vendor }: { vendor: VendorIdentity }) {
  return (
    <span
      className={`${styles.vendorLogo} ${vendor.imageClassName}`}
      role="img"
      aria-label={`${vendor.name} software vendor`}
      title={`${vendor.name} software vendor`}
    />
  );
}

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

function healthTagType(health: HealthKey): CarbonTagType {
  return ({
    green: "green",
    amber: "warm-gray",
    red: "red",
    grey: "cool-gray",
  } as const)[health];
}

function stageKey(stage: string): StageKey {
  switch (stage.trim().toLowerCase()) {
    case "completed":
      return "completed";
    case "in progress":
      return "in-progress";
    case "tendering":
    case "requirements":
    case "award / contract signing":
    case "contract signing":
      return "tendering";
    case "not started":
    case "on hold":
      return "not-started";
    default:
      return "default";
  }
}

function stageDisplayLabel(stage: string) {
  const normalized = stage.trim().toLowerCase();

  if (normalized === "award / contract signing" || normalized === "contract signing") {
    return "Award / Signing";
  }

  return stage || "Not set";
}

function stageTagType(stage: StageKey): CarbonTagType {
  return ({
    completed: "green",
    "in-progress": "blue",
    tendering: "purple",
    "not-started": "gray",
    default: "cool-gray",
  } as const)[stage];
}

function projectGroupKey(stage: string): ProjectGroupKey {
  const normalized = stage.trim().toLowerCase();

  if (normalized === "completed") {
    return "completed";
  }

  if (normalized === "not started") {
    return "not-started";
  }

  if (
    normalized === "tendering" ||
    normalized === "requirements" ||
    normalized.includes("award") ||
    normalized.includes("contract signing")
  ) {
    return "tendering";
  }

  return "in-progress";
}

function managementFocus(project: ProjectRecord) {
  return project.managementUpdate?.trim() || "No management update recorded.";
}

function splitManagementUpdate(text: string) {
  const points = text
    .replace(/\r/g, "")
    .split(/\s+(?=\d+\.\s)/)
    .map((point) => point.trim())
    .filter(Boolean);

  if (points.length < 2 || !points.every((point) => /^\d+\.\s/.test(point))) {
    return [];
  }

  return points.map((point) => point.replace(/^\d+\.\s*/, "")).filter(Boolean);
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

function PortfolioHealthSummary({ projects }: { projects: ProjectRecord[] }) {
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
  const chartData = (Object.keys(HEALTH_DETAILS) as HealthKey[])
    .filter((key) => healthCounts[key] > 0)
    .map((key) => ({
      group: HEALTH_DETAILS[key].label,
      value: healthCounts[key],
    }));
  const chartOptions: DonutChartOptions = {
    accessibility: {
      svgAriaLabel: `Health distribution for ${totalProjects} projects`,
    },
    data: {
      groupMapsTo: "group",
    },
    donut: {
      center: {
        label: "projects",
        number: totalProjects,
      },
    },
    pie: {
      labels: {
        enabled: false,
      },
    },
    getFillColor: (group) =>
      Object.values(HEALTH_DETAILS).find((detail) => detail.label === group)?.chartColor ??
      "var(--cds-icon-secondary)",
    height: "100%",
    legend: {
      enabled: false,
    },
    resizable: true,
    toolbar: {
      enabled: false,
    },
  };

  return (
    <Tile className={styles.summaryTile} role="region" aria-labelledby="portfolio-health-title">
      <div className={styles.chartWrap}>
        <DonutChart key="carbon-portfolio-health-donut" data={chartData} options={chartOptions} />
      </div>
      <Stack className={styles.summaryContent} gap={4}>
        <p className={styles.eyebrow}>Portfolio health</p>
        <h2 className={styles.summaryTitle} id="portfolio-health-title">
          Delivery health distribution
        </h2>
        <p className={styles.summaryText}>A quick view of where leadership attention is needed across the portfolio.</p>
        <Stack as="ul" className={styles.healthLegend} gap={3} orientation="horizontal" aria-label="Project health totals">
          {(Object.keys(HEALTH_DETAILS) as HealthKey[]).map((key) => (
            <li key={key}>
              <Tag className={styles.filledTag} type={healthTagType(key)} size="sm">
                {HEALTH_DETAILS[key].label} {healthCounts[key]}
              </Tag>
            </li>
          ))}
        </Stack>
      </Stack>
      <div className={styles.stageMetrics} role="group" aria-label="Project stage totals">
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

function ProjectStatusCard({ project }: { project: ProjectRecord }) {
  const progress = deriveProgressPercent(project.progressPercent, project.currentPosition, project.projectStage) ?? 0;
  const health = healthKey(project.health);
  const projectBudget = formatBudget(project.contractValue, project.budgetCurrency);
  const managementUpdate = managementFocus(project);
  const managementUpdatePoints = splitManagementUpdate(managementUpdate);
  const softwareVendor = inferSoftwareVendor(project);

  return (
    <ClickableTile
      href={`/projects/${project.id}`}
      className={styles.projectCard}
      aria-label={`Open ${project.projectName}`}
    >
      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <div className={styles.cardMetaRow}>
              <p className={styles.projectCode}>{project.projectCode}</p>
              <p className={styles.lastUpdated}>
                <Time size={14} aria-hidden="true" />
                {formatCompactDate(project.lastUpdated) ?? "No update date"}
              </p>
            </div>
            <h2 className={styles.projectName}>{project.projectName}</h2>
            <p className={styles.projectDescription}>
              {project.projectDescription?.trim() || "No project description is recorded."}
            </p>
          </div>
          <div className={styles.healthSignal}>
            <p className={styles.fieldLabel}>Health</p>
            <Tag className={styles.filledTag} type={healthTagType(health)} size="sm">
              {HEALTH_DETAILS[health].label}
            </Tag>
            {softwareVendor ? <VendorMark vendor={softwareVendor} /> : null}
          </div>
        </div>

        <div className={styles.projectSnapshot} aria-label="Project delivery summary">
          <div className={styles.progressSummary}>
            <div className={styles.deliveryGauge}>
              <GaugeChart
                data={[{ group: "value", value: progress }]}
                options={PROJECT_GAUGE_OPTIONS}
              />
            </div>
            <p className={styles.progressLabel}>Delivery progress</p>
          </div>
          <div className={styles.deliveryBadgeGroup}>
            <p className={styles.fieldLabel}>Current stage</p>
            <Tag
              className={styles.filledTag}
              type={stageTagType(stageKey(project.projectStage))}
              size="sm"
              title={project.projectStage || "Not set"}
            >
              {stageDisplayLabel(project.projectStage)}
            </Tag>
          </div>
          <div className={styles.deliveryBadgeGroup}>
            <p className={styles.fieldLabel}>Contract value</p>
            <p className={styles.budgetValue} title={projectBudget}>{projectBudget}</p>
          </div>
        </div>

        <div className={styles.factsGrid} aria-label="Project facts">
          <div className={styles.factItem}>
            <p className={styles.fieldLabel}>Business owner</p>
            <p className={`${styles.factValue} ${styles.businessOwner}`}>
              {project.projectSponsor?.trim() || "Not specified"}
            </p>
          </div>
          <div className={styles.factItem}>
            <p className={styles.fieldLabel}>Project start</p>
            <p className={styles.factValue}>{formatCompactDate(project.startDate) ?? "Not set"}</p>
          </div>
          <div className={styles.factItem}>
            <p className={styles.fieldLabel}>Expected end</p>
            <p className={styles.factValue}>{formatCompactDate(project.endDate) ?? "Not scheduled"}</p>
          </div>
        </div>

        <div className={styles.managementGrid}>
          <div className={styles.managementItem}>
            {health === "green" ? (
              <CheckmarkFilled className={styles.managementSuccess} size={18} aria-hidden="true" />
            ) : (
              <WarningAltFilled className={styles.managementWarning} size={18} aria-hidden="true" />
            )}
            <div>
              <p className={styles.fieldLabel}>Management update</p>
              {managementUpdatePoints.length ? (
                <ol className={styles.managementPoints}>
                  {managementUpdatePoints.slice(0, 2).map((point, index) => (
                    <li key={`${index}-${point}`}>{point}</li>
                  ))}
                </ol>
              ) : (
                <p className={styles.managementValue}>{managementUpdate}</p>
              )}
            </div>
          </div>
        </div>

        <div className={styles.cardAction} aria-hidden="true">
          <span>View project</span>
          <ArrowRight size={16} />
        </div>
      </div>
    </ClickableTile>
  );
}

export function ProjectStatusBoard({
  showDashboardBreadcrumb = true,
}: {
  showDashboardBreadcrumb?: boolean;
}) {
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
        items={
          showDashboardBreadcrumb
            ? [
                { label: "Dashboard", href: "/dashboard" },
                { label: "Project status" },
              ]
            : [{ label: "Project status" }]
        }
      />

      <header className={styles.hero}>
        <h1 className={styles.title}>Project status at a glance</h1>
      </header>

      <Tile className={styles.filterBar} role="region" aria-label="Project status filters">
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
          labelText="Contract value"
          size="sm"
          value={budgetFilter}
          disabled={!projects}
          onChange={(event) => setBudgetFilter(event.target.value as BudgetFilter)}
        >
          <SelectItem value="all" text="All contract values" />
          <SelectItem value="recorded" text="Contract value recorded" />
          <SelectItem value="missing" text="No contract value" />
          <SelectItem value="under-1m" text="Under 1 million" />
          <SelectItem value="1m-10m" text="1–10 million" />
          <SelectItem value="10m-plus" text="10 million+" />
        </Select>
        <div className={styles.filterActions}>
          <p className={styles.filterResult}>
            {projects ? `${filteredProjects.length} of ${projects.length} projects` : "Loading projects"}
          </p>
          <Button kind="ghost" size="sm" disabled={!hasActiveFilters} onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      </Tile>

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
          <PortfolioHealthSummary projects={filteredProjects} />
          {filteredProjects.length ? (
            <Accordion className={styles.projectGroups} align="end" size="lg">
              {PROJECT_GROUPS.map((group) => {
                const groupProjects = filteredProjects.filter(
                  (project) => projectGroupKey(project.projectStage) === group.key,
                );

                if (!groupProjects.length) {
                  return null;
                }

                return (
                  <AccordionItem
                    className={styles.projectGroup}
                    key={group.key}
                    open={group.key !== "not-started"}
                    aria-label={`${group.label}, ${groupProjects.length} projects`}
                    title={
                      <span className={styles.projectGroupTitleRow}>
                        <span className={styles.projectGroupTitle}>{group.label}</span>
                        <Tag className={styles.filledTag} type="cool-gray" size="sm">
                          {groupProjects.length} projects
                        </Tag>
                      </span>
                    }
                  >
                    <div className={styles.projectGrid}>
                      {groupProjects.map((project) => (
                        <ProjectStatusCard key={project.id} project={project} />
                      ))}
                    </div>
                  </AccordionItem>
                );
              })}
            </Accordion>
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
