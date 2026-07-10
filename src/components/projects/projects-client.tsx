"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, startTransition, useEffect, useState } from "react";
import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineNotification,
  ProgressBar,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TextInput,
} from "@carbon/react";
import type { DataTableHeader } from "@carbon/react";

import { AppBreadcrumbs } from "@/components/navigation/app-breadcrumbs";
import { getLateDays, tracksReportingCadence } from "@/lib/domain/project-sync";
import { ProjectForm } from "@/components/projects/project-form";
import { StructuredNarrative } from "@/components/projects/structured-narrative";
import { deriveProgressPercent, formatDisplayDate } from "@/lib/utils/format";

type ProjectRecord = {
  id: string;
  projectCode: string;
  projectName: string;
  projectStage: string;
  pmName: string;
  projectSponsor?: string | null;
  progressPercent?: number | null;
  health: string;
  priority: string;
  updateFrequency: string;
  lastUpdated?: string | null;
  pendingWith?: string | null;
  mainBlockerRisk?: string | null;
  currentPosition?: string | null;
  keyNextAction?: string | null;
  nextMilestone?: string | null;
  nextMilestoneDate?: string | null;
  lastEmailSent?: string | null;
};

type UserRecord = { id: string; name: string; email: string; role: string };
type WeeklyUpdateRecord = {
  id: string;
  projectId: string;
  updateDate: string;
  stage: string;
  health: string;
  whatHappened: string;
  nextStep: string;
};

type ProjectTableRow = {
  id: string;
  projectCode: string;
  projectName: string;
  currentPosition: string;
  progress: number;
  projectStage: string;
  health: string;
  priority: string;
  pmName: string;
  lastUpdated: string;
  lastEmailSent: string;
};

const inFlightStages = ["In Progress", "Requirements", "Tendering"];

const projectTableHeaders: DataTableHeader[] = [
  { key: "projectCode", header: "Project ID" },
  { key: "projectName", header: "Name" },
  { key: "currentPosition", header: "Current Status" },
  { key: "progress", header: "Progress %" },
  { key: "projectStage", header: "Stage" },
  { key: "health", header: "Health" },
  { key: "pmName", header: "PM" },
  { key: "priority", header: "Priority" },
  { key: "lastUpdated", header: "Last updated" },
  { key: "lastEmailSent", header: "Last email sent" },
];

function healthCellClassName(health: string) {
  if (health === "Red") {
    return "app-colored-cell app-colored-cell--health-red";
  }

  if (health === "Amber") {
    return "app-colored-cell app-colored-cell--health-amber";
  }

  if (health === "Grey") {
    return "app-colored-cell app-colored-cell--health-grey";
  }

  return "app-colored-cell app-colored-cell--health-green";
}

function priorityCellClassName(priority: string) {
  if (priority.startsWith("P1")) {
    return "app-colored-cell app-colored-cell--priority-p1";
  }

  if (priority.startsWith("P2")) {
    return "app-colored-cell app-colored-cell--priority-p2";
  }

  if (priority.startsWith("P3")) {
    return "app-colored-cell app-colored-cell--priority-p3";
  }

  return "app-colored-cell app-colored-cell--priority-default";
}

function stageCellClassName(stage: string) {
  const normalized = stage.toLowerCase();

  if (normalized === "completed") {
    return "app-colored-cell app-colored-cell--stage-completed";
  }

  if (normalized === "in progress") {
    return "app-colored-cell app-colored-cell--stage-in-progress";
  }

  if (normalized === "tendering") {
    return "app-colored-cell app-colored-cell--stage-tendering";
  }

  if (normalized === "requirements") {
    return "app-colored-cell app-colored-cell--stage-requirements";
  }

  if (normalized === "not started") {
    return "app-colored-cell app-colored-cell--stage-not-started";
  }

  return "app-colored-cell app-colored-cell--stage-default";
}

export function ProjectsClient({
  canCreateProjects,
}: {
  canCreateProjects: boolean;
}) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [lookups, setLookups] = useState<Record<string, string[]>>({});
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [updatesByProject, setUpdatesByProject] = useState<
    Record<string, { count: number; latestUpdateDate: string | null; latestStage: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    projectCode: searchParams.get("projectCode") ?? "",
    projectName: searchParams.get("projectName") ?? "",
    currentPosition: searchParams.get("currentPosition") ?? "",
    progress: searchParams.get("progress") ?? "",
    projectStage: searchParams.get("projectStage") ?? "",
    health: searchParams.get("health") ?? "",
    priority: searchParams.get("priority") ?? "",
    pmName: searchParams.get("pmName") ?? "",
    lastUpdated: searchParams.get("lastUpdated") ?? "",
    lastEmailSent: searchParams.get("lastEmailSent") ?? "",
    stageGroup: searchParams.get("stageGroup") ?? "",
    lateOnly: searchParams.get("lateOnly") ?? "",
  }));
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadProjects(signal?: AbortSignal) {
    const [projectsResponse, updatesResponse] = await Promise.all([
      fetch("/api/projects", { cache: "no-store", signal }),
      fetch("/api/weekly-updates", { cache: "no-store", signal }),
    ]);

    if (!projectsResponse.ok || !updatesResponse.ok) {
      throw new Error("Projects could not be loaded.");
    }

    const result = (await projectsResponse.json()) as {
      projects: ProjectRecord[];
      lookups: Record<string, string[]>;
      users: UserRecord[];
    };
    const updatesResult = (await updatesResponse.json()) as {
      updates: WeeklyUpdateRecord[];
    };

    const updateSummary = (updatesResult.updates ?? []).reduce<
      Record<string, { count: number; latestUpdateDate: string | null; latestStage: string | null }>
    >((acc, update) => {
      const current = acc[update.projectId] ?? {
        count: 0,
        latestUpdateDate: null,
        latestStage: null,
      };

      if (!current.latestUpdateDate || update.updateDate > current.latestUpdateDate) {
        current.latestUpdateDate = update.updateDate;
        current.latestStage = update.stage;
      }

      current.count += 1;
      acc[update.projectId] = current;
      return acc;
    }, {});

    return { ...result, updateSummary };
  }

  useEffect(() => {
    let active = true;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    async function hydrateProjects() {
      startTransition(() => setLoading(true));
      setLoadError(null);

      try {
        const result = await loadProjects(controller.signal);

        if (!active) {
          return;
        }

        startTransition(() => {
          setProjects(result.projects ?? []);
          setLookups(result.lookups ?? {});
          setUsers(result.users ?? []);
          setUpdatesByProject(result.updateSummary ?? {});
          setLoading(false);
        });
      } catch (error) {
        if (!active) {
          return;
        }

        startTransition(() => {
          setLoadError(timedOut ? "Projects took too long to load. Please try again." : error instanceof Error ? error.message : "Projects could not be loaded.");
          setLoading(false);
        });
      }
    }

    void hydrateProjects();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const filteredProjects = projects
    .filter((project) => {
      const progressPercent = deriveProgressPercent(
        project.progressPercent,
        project.currentPosition,
        project.projectStage,
      );
      const matchesProjectCode = project.projectCode
        .toLowerCase()
        .includes(filters.projectCode.toLowerCase());
      const matchesProjectName = project.projectName
        .toLowerCase()
        .includes(filters.projectName.toLowerCase());
      const matchesCurrentPosition = (project.currentPosition ?? "")
        .toLowerCase()
        .includes(filters.currentPosition.toLowerCase());
      const matchesProgress = !filters.progress
        || String(progressPercent ?? "").includes(filters.progress);
      const matchesStageGroup = filters.stageGroup !== "inFlight" || inFlightStages.includes(project.projectStage);
      const lateDays = getLateDays(project.lastUpdated ?? null, project.updateFrequency);
      const matchesLateOnly =
        filters.lateOnly !== "true" ||
        (tracksReportingCadence(project.projectStage) && lateDays > 0 && Number.isFinite(lateDays));
      const matchesStage = !filters.projectStage || project.projectStage === filters.projectStage;
      const matchesHealth = !filters.health || project.health === filters.health;
      const matchesPriority = !filters.priority || project.priority === filters.priority;
      const matchesPm = !filters.pmName || project.pmName === filters.pmName;
      const displayLastUpdated = formatDisplayDate(project.lastUpdated) ?? "";
      const matchesLastUpdated = displayLastUpdated
        .toLowerCase()
        .includes(filters.lastUpdated.toLowerCase());
      const displayLastEmailSent = formatDisplayDate(project.lastEmailSent) ?? "";
      const matchesLastEmailSent = displayLastEmailSent
        .toLowerCase()
        .includes(filters.lastEmailSent.toLowerCase());

      return (
        matchesProjectCode &&
        matchesProjectName &&
        matchesCurrentPosition &&
        matchesProgress &&
        matchesStageGroup &&
        matchesLateOnly &&
        matchesStage &&
        matchesHealth &&
        matchesPriority &&
        matchesPm &&
        matchesLastUpdated &&
        matchesLastEmailSent
      );
    });

  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const projectTableRows: ProjectTableRow[] = filteredProjects.map((project) => {
    const progressPercent = deriveProgressPercent(
      project.progressPercent,
      project.currentPosition,
      project.projectStage,
    );

    return {
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      currentPosition: project.currentPosition ?? "No current status captured yet.",
      progress: progressPercent ?? -1,
      projectStage: project.projectStage,
      health: project.health,
      priority: project.priority,
      pmName: project.pmName,
      lastUpdated: project.lastUpdated ?? "",
      lastEmailSent: project.lastEmailSent ?? "",
    };
  });

  function updateFilter(
    key: keyof typeof filters,
    value: string | null | undefined,
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value ?? "",
      ...(key === "projectStage" ? { stageGroup: "" } : {}),
    }));
  }

  function readSelectValue(event: { target?: { value?: string | null } } | null | undefined) {
    return event?.target?.value ?? "";
  }

  return (
    <div className="app-page">
      <section className="app-page__hero">
        <AppBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Projects" },
          ]}
        />
        <p className="app-page__eyebrow">Master tracker</p>
        <h1 className="app-page__title">Projects</h1>
        <p className="app-page__subtitle">
          Manage the current portfolio using the same structure as the Excel tracker, with enterprise-grade audit history and email controls.
        </p>
      </section>
      {canCreateProjects ? (
        <section className="app-card app-stack">
          <div className="app-card__header">
            <div>
              <h2 className="app-card__title">Portfolio administration</h2>
              <p className="app-helper-text">
                Add new projects only when you need a fresh master-tracker record. The creation form stays collapsed by default.
              </p>
            </div>
            <Button
              kind={showCreateForm ? "secondary" : "primary"}
              onClick={() => setShowCreateForm((current) => !current)}
            >
              {showCreateForm ? "Hide Project Form" : "Add Project"}
            </Button>
          </div>
          {showCreateForm ? (
            <ProjectForm
              mode="create"
              lookups={lookups}
              users={users}
              onSaved={() => {
                startTransition(() => setLoading(true));
                void (async () => {
                  const result = await loadProjects();

                  startTransition(() => {
                    setProjects(result.projects ?? []);
                    setLookups(result.lookups ?? {});
                    setUsers(result.users ?? []);
                    setUpdatesByProject(result.updateSummary ?? {});
                    setShowCreateForm(false);
                    setLoading(false);
                  });
                })();
              }}
            />
          ) : null}
        </section>
      ) : null}
      <section className="app-card app-stack">
        {loadError ? (
          <InlineNotification
            kind="error"
            title="Projects could not load"
            subtitle={loadError}
            lowContrast
          />
        ) : null}
        {loading ? (
          <DataTableSkeleton rowCount={6} columnCount={7} />
        ) : loadError ? null : (
          <DataTable<ProjectTableRow, unknown[]>
            rows={projectTableRows}
            headers={projectTableHeaders}
            isSortable
            size="lg"
          >
            {({
              rows,
              headers,
              getHeaderProps,
              getExpandHeaderProps,
              getRowProps,
              getExpandedRowProps,
              getTableProps,
              getTableContainerProps,
              onInputChange,
            }) => (
              <TableContainer
                title="Project master tracker"
                description="Search, scan, sort, and expand rows to review weekly project context in-place."
                {...getTableContainerProps()}
              >
                <div className="app-table-controls">
                  <TableToolbar aria-label="Project table toolbar">
                    <TableToolbarContent>
                      <TableToolbarSearch
                        persistent
                        placeholder="Search projects"
                        labelText="Search projects"
                        onChange={onInputChange}
                      />
                    </TableToolbarContent>
                  </TableToolbar>
                  <div className="app-table-filter-grid">
                <TextInput
                  id="filter-project-code"
                  size="sm"
                  labelText="Filter Project ID"
                  value={filters.projectCode}
                  onChange={(event) => updateFilter("projectCode", event.currentTarget.value)}
                />
                <TextInput
                  id="filter-project-name"
                  size="sm"
                  labelText="Filter Name"
                  value={filters.projectName}
                  onChange={(event) => updateFilter("projectName", event.currentTarget.value)}
                />
                <TextInput
                  id="filter-current-position"
                  size="sm"
                  labelText="Filter Current Status"
                  value={filters.currentPosition}
                  onChange={(event) => updateFilter("currentPosition", event.currentTarget.value)}
                />
                <TextInput
                  id="filter-progress"
                  size="sm"
                  labelText="Filter Progress %"
                  placeholder="80"
                  value={filters.progress}
                  onChange={(event) => updateFilter("progress", event.currentTarget.value)}
                />
                <Select
                  id="filter-stage"
                  size="sm"
                  labelText="Filter Stage"
                  value={filters.projectStage}
                  onChange={(event) => updateFilter("projectStage", readSelectValue(event))}
                >
                  <SelectItem text="All stages" value="" />
                  {(lookups.project_stage ?? []).map((value) => (
                    <SelectItem key={value} text={value} value={value} />
                  ))}
                </Select>
                <Select
                  id="filter-health"
                  size="sm"
                  labelText="Filter Health"
                  value={filters.health}
                  onChange={(event) => updateFilter("health", readSelectValue(event))}
                >
                  <SelectItem text="All health" value="" />
                  {(lookups.health ?? []).map((value) => (
                    <SelectItem key={value} text={value} value={value} />
                  ))}
                </Select>
                <Select
                  id="filter-priority"
                  size="sm"
                  labelText="Filter Priority"
                  value={filters.priority}
                  onChange={(event) => updateFilter("priority", readSelectValue(event))}
                >
                  <SelectItem text="All priorities" value="" />
                  {(lookups.priority ?? []).map((value) => (
                    <SelectItem key={value} text={value} value={value} />
                  ))}
                </Select>
                <Select
                  id="filter-pm"
                  size="sm"
                  labelText="Filter PM"
                  value={filters.pmName}
                  onChange={(event) => updateFilter("pmName", readSelectValue(event))}
                >
                  <SelectItem text="All PMs" value="" />
                  {Array.from(new Set(projects.map((project) => project.pmName).filter(Boolean))).map(
                    (value) => (
                      <SelectItem key={value} text={value} value={value} />
                    ),
                  )}
                </Select>
                <TextInput
                  id="filter-last-updated"
                  size="sm"
                  labelText="Filter Last Updated"
                  placeholder="3rd March 2026"
                  value={filters.lastUpdated}
                  onChange={(event) => updateFilter("lastUpdated", event.currentTarget.value)}
                />
                <TextInput
                  id="filter-last-email-sent"
                  size="sm"
                  labelText="Filter Last Email Sent"
                  placeholder="3rd March 2026"
                  value={filters.lastEmailSent}
                  onChange={(event) => updateFilter("lastEmailSent", event.currentTarget.value)}
                />
              </div>
            </div>
            <div className="app-table-wrap">
              <Table className="app-projects-table" {...getTableProps()}>
                <colgroup>
                  <col className="app-projects-table__expander" />
                  <col className="app-projects-table__serial" />
                  <col className="app-projects-table__code" />
                  <col className="app-projects-table__name" />
                  <col className="app-projects-table__position" />
                  <col className="app-projects-table__progress" />
                  <col className="app-projects-table__stage" />
                  <col className="app-projects-table__health" />
                  <col className="app-projects-table__pm" />
                  <col className="app-projects-table__priority" />
                  <col className="app-projects-table__updated" />
                  <col className="app-projects-table__email" />
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableExpandHeader {...getExpandHeaderProps()} />
                    <TableHeader>S/N</TableHeader>
                    {headers.map((header) => {
                      const { key, ...headerProps } = getHeaderProps({ header });

                      return (
                        <TableHeader key={key} {...headerProps}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, index) => {
                    const project = projectsById.get(row.id);

                    if (!project) {
                      return null;
                    }

                    const weeklyActivity = updatesByProject[project.id];
                    const progressPercent = deriveProgressPercent(
                      project.progressPercent,
                      project.currentPosition,
                      project.projectStage,
                    );
                    const { key: rowKey, ...rowProps } = getRowProps({ row });

                    return (
                      <Fragment key={rowKey}>
                        <TableExpandRow {...rowProps}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Link href={`/projects/${project.id}`}>{project.projectCode}</Link>
                          </TableCell>
                          <TableCell
                            className="app-table-cell--truncate"
                            title={project.projectName}
                          >
                            {project.projectName}
                          </TableCell>
                          <TableCell
                            className="app-table-cell--truncate"
                            title={project.currentPosition ?? "No current status captured yet."}
                          >
                            {project.currentPosition ?? "No current status captured yet."}
                          </TableCell>
                          <TableCell>
                            <div className="app-progress-cell">
                              <ProgressBar
                                label={`Progress for ${project.projectCode}`}
                                hideLabel
                                helperText=""
                                max={100}
                                size="small"
                                type="inline"
                                value={progressPercent ?? 0}
                                status={progressPercent == null ? undefined : "active"}
                              />
                              <span className="app-progress-cell__value-text">
                                {progressPercent == null ? "N/A" : `${progressPercent}%`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={stageCellClassName(project.projectStage)}>
                            {project.projectStage}
                          </TableCell>
                          <TableCell className={healthCellClassName(project.health)}>
                            {project.health}
                          </TableCell>
                          <TableCell>{project.pmName}</TableCell>
                          <TableCell className={priorityCellClassName(project.priority)}>
                            {project.priority}
                          </TableCell>
                          <TableCell>
                            {formatDisplayDate(project.lastUpdated) ?? "Not updated"}
                          </TableCell>
                          <TableCell>
                            {formatDisplayDate(project.lastEmailSent) ?? "No email sent"}
                          </TableCell>
                        </TableExpandRow>
                        <TableExpandedRow colSpan={12} {...getExpandedRowProps({ row })}>
                          <div className="app-table-details">
                            <div className="app-table-details__grid">
                              <div>
                                <h3 className="app-table-details__label">Current status</h3>
                                <p>
                                  <StructuredNarrative
                                    text={project.currentPosition}
                                    fallback="No current status captured yet."
                                  />
                                </p>
                              </div>
                              <div>
                                <h3 className="app-table-details__label">
                                  {project.projectStage.toLowerCase() === "completed"
                                    ? "Completed deliverables"
                                    : "Current action"}
                                </h3>
                                <p>
                                  {project.keyNextAction ??
                                    (project.projectStage.toLowerCase() === "completed"
                                      ? "No completed deliverables captured yet."
                                      : "No current action captured yet.")}
                                </p>
                              </div>
                              <div>
                                <h3 className="app-table-details__label">Current action owner</h3>
                                <p>{project.pendingWith ?? "Not specified"}</p>
                              </div>
                              <div>
                                <h3 className="app-table-details__label">Project sponsor</h3>
                                <p>{project.projectSponsor ?? "Not specified"}</p>
                              </div>
                              <div>
                                <h3 className="app-table-details__label">Next milestone</h3>
                                <p>
                                  {project.nextMilestone ?? "No milestone set"}
                                  {project.nextMilestoneDate
                                    ? ` • ${formatDisplayDate(project.nextMilestoneDate) ?? project.nextMilestoneDate}`
                                    : ""}
                                </p>
                              </div>
                              <div>
                                <h3 className="app-table-details__label">Blocker / risk</h3>
                                <p>{project.mainBlockerRisk ?? "No active blocker recorded."}</p>
                              </div>
                              <div>
                                <h3 className="app-table-details__label">Reporting cadence</h3>
                                <p>{project.updateFrequency}</p>
                              </div>
                              <div>
                                <h3 className="app-table-details__label">Weekly submissions</h3>
                                <p>
                                  {weeklyActivity?.count
                                    ? `${weeklyActivity.count} update${weeklyActivity.count === 1 ? "" : "s"} recorded`
                                    : "No weekly submissions recorded yet."}
                                  {weeklyActivity?.latestUpdateDate
                                    ? ` • Latest ${formatDisplayDate(weeklyActivity.latestUpdateDate) ?? weeklyActivity.latestUpdateDate}`
                                    : ""}
                                  {weeklyActivity?.latestStage
                                    ? ` • ${weeklyActivity.latestStage}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                            <div className="app-inline-actions">
                              <Button
                                as={Link}
                                href={`/projects/${project.id}`}
                                kind="tertiary"
                                size="sm"
                              >
                                Open project workspace
                              </Button>
                              <Button
                                as={Link}
                                href={`/projects/${project.id}#weekly-history`}
                                kind="ghost"
                                size="sm"
                              >
                                View weekly history
                              </Button>
                            </div>
                          </div>
                        </TableExpandedRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
              </TableContainer>
            )}
          </DataTable>
        )}
      </section>
    </div>
  );
}
