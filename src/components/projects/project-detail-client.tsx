"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Modal,
  ProgressBar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from "@carbon/react";
import {
  Milestone,
  Task,
  WarningAlt,
} from "@carbon/icons-react";

import { AppBreadcrumbs } from "@/components/navigation/app-breadcrumbs";
import { MilestoneManager } from "@/components/projects/milestone-manager";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectRiskManager } from "@/components/projects/project-risk-manager";
import { formatDisplayDate } from "@/lib/utils/format";

type ProjectResponse = {
  project: {
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
    primaryPmUserId?: string | null;
    weeklyEmailEnabled?: boolean;
    monthlyEmailEnabled?: boolean;
    recipients: Array<{
      id: string;
      email: string;
      recipientType: "to" | "cc";
      name?: string | null;
    }>;
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
  };
};

type UserRecord = { id: string; name: string; email: string; role: string };

const workspaceSections = [
  { id: "overview", anchor: "workspace-overview", label: "Overview" },
  { id: "snapshot", anchor: "snapshot", label: "Snapshot" },
  { id: "delivery", anchor: "delivery", label: "Delivery narrative" },
  { id: "risks", anchor: "risks", label: "Risks & issues" },
  { id: "milestones", anchor: "milestones", label: "Milestones" },
  { id: "weekly-history", anchor: "weekly-history", label: "Weekly history" },
];

type WorkspaceTileId = "status" | "blocker" | "steps" | "milestone";

async function loadProjectPayload(projectId: string, signal?: AbortSignal) {
  const [projectResponse, projectsResponse] = await Promise.all([
    fetch(`/api/projects/${projectId}`, { cache: "no-store", signal }),
    fetch("/api/projects", { cache: "no-store", signal }),
  ]);

  if (!projectResponse.ok || !projectsResponse.ok) {
    throw new Error("Project record could not be loaded.");
  }

  const projectResult = (await projectResponse.json()) as ProjectResponse;
  const supporting = (await projectsResponse.json()) as {
    lookups: Record<string, string[]>;
    users: UserRecord[];
  };

  return {
    project: projectResult.project,
    lookups: supporting.lookups ?? {},
    users: supporting.users ?? [],
  };
}

function loadProjectHealthTag(health: string) {
  if (health === "Red") {
    return "red";
  }

  if (health === "Amber") {
    return "warm-gray";
  }

  if (health === "Grey") {
    return "gray";
  }

  return "green";
}

function loadProjectHealthTagClassName(health: string) {
  if (health === "Red") {
    return "app-health-tag app-health-tag--red";
  }

  if (health === "Amber") {
    return "app-health-tag app-health-tag--amber";
  }

  if (health === "Grey") {
    return "app-health-tag app-health-tag--grey";
  }

  return "app-health-tag app-health-tag--green";
}

function loadProjectPriorityTag(priority: string) {
  if (priority.startsWith("P1")) {
    return "red";
  }

  if (priority.startsWith("P2")) {
    return "purple";
  }

  if (priority.startsWith("P3")) {
    return "teal";
  }

  return "gray";
}

function loadMilestoneStatusTag(status: string) {
  if (status === "completed") {
    return "green";
  }

  if (status === "in_progress") {
    return "blue";
  }

  if (status === "at_risk") {
    return "red";
  }

  return "gray";
}

function loadMilestoneStatusTagClassName(status: string) {
  if (status === "completed") {
    return "app-milestone-tag app-milestone-tag--completed";
  }

  if (status === "in_progress") {
    return "app-milestone-tag app-milestone-tag--in-progress";
  }

  if (status === "at_risk") {
    return "app-milestone-tag app-milestone-tag--at-risk";
  }

  return "app-milestone-tag app-milestone-tag--planned";
}

function formatMilestoneStatus(status: string) {
  return status.replace(/_/g, " ");
}

function loadRiskStatusTag(status: string) {
  if (status === "closed") {
    return "green";
  }

  if (status === "mitigated") {
    return "teal";
  }

  if (status === "monitoring") {
    return "cool-gray";
  }

  return "red";
}

function loadRiskStatusTagClassName(status: string) {
  if (status === "closed") {
    return "app-risk-tag app-risk-tag--closed";
  }

  if (status === "mitigated") {
    return "app-risk-tag app-risk-tag--mitigated";
  }

  if (status === "monitoring") {
    return "app-risk-tag app-risk-tag--monitoring";
  }

  return "app-risk-tag app-risk-tag--open";
}

function loadRiskSeverityTag(severity: string) {
  if (severity === "critical") {
    return "red";
  }

  if (severity === "high") {
    return "magenta";
  }

  if (severity === "medium") {
    return "purple";
  }

  return "gray";
}

function loadRiskSeverityTagClassName(severity: string) {
  if (severity === "critical") {
    return "app-risk-severity-tag app-risk-severity-tag--critical";
  }

  if (severity === "high") {
    return "app-risk-severity-tag app-risk-severity-tag--high";
  }

  if (severity === "medium") {
    return "app-risk-severity-tag app-risk-severity-tag--medium";
  }

  return "app-risk-severity-tag app-risk-severity-tag--low";
}

function formatRiskLabel(value: string) {
  return value.replace(/_/g, " ");
}

function compactNotes(notes?: string | null) {
  return (notes ?? "").replace(/\s+/g, " ").trim();
}

function formatMoney(value?: string | null, currency?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return `${currency ?? "AED"} ${value}`;
  }

  const code = (currency ?? "AED").trim().toUpperCase();

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
    return "Not available";
  }

  const planned = new Date(plannedEnd);
  const actual = new Date(actualEnd);
  if (Number.isNaN(planned.getTime()) || Number.isNaN(actual.getTime())) {
    return "Not available";
  }

  const days = Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return "On plan";
  }

  return days > 0 ? `${days} days delayed` : `${Math.abs(days)} days early`;
}

function ProgressGauge({ value }: { value?: number | null }) {
  if (value == null) {
    return <span className="app-detail-field__value">Not set</span>;
  }

  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className="app-progress-gauge"
      role="img"
      aria-label={`Delivery progress ${normalizedValue}%`}
    >
      <svg viewBox="0 0 120 70" aria-hidden="true" focusable="false">
        <path className="app-progress-gauge__track" d="M16 58 A44 44 0 0 1 104 58" pathLength="100" />
        <path
          className="app-progress-gauge__value"
          d="M16 58 A44 44 0 0 1 104 58"
          pathLength="100"
          style={{ strokeDashoffset: 100 - normalizedValue }}
        />
      </svg>
      <strong>{normalizedValue}%</strong>
    </div>
  );
}

export function ProjectDetailClient({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [projectData, setProjectData] = useState<ProjectResponse["project"] | null>(null);
  const [lookups, setLookups] = useState<Record<string, string[]>>({});
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncingMaster, setSyncingMaster] = useState(false);
  const [syncMasterMessage, setSyncMasterMessage] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [editingMilestones, setEditingMilestones] = useState(false);
  const [editingRisks, setEditingRisks] = useState(false);
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState("overview");
  const [activeWorkspaceTile, setActiveWorkspaceTile] = useState<WorkspaceTileId | null>(null);
  const activeSectionLockRef = useRef<string | null>(null);
  const activeSectionUnlockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    async function loadProject() {
      startTransition(() => setLoading(true));
      setLoadError(null);

      try {
        const result = await loadProjectPayload(projectId, controller.signal);

        if (!active) {
          return;
        }

        startTransition(() => {
          setProjectData(result.project);
          setLookups(result.lookups);
          setUsers(result.users);
          setLoading(false);
        });
      } catch (error) {
        if (!active) {
          return;
        }

        startTransition(() => {
          setLoadError(timedOut ? "Project record took too long to load. Please try again." : error instanceof Error ? error.message : "Project record could not be loaded.");
          setLoading(false);
        });
      }
    }

    void loadProject();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectData) {
      return;
    }

    const updateActiveSection = () => {
      if (activeSectionLockRef.current) {
        return;
      }

      const viewportAnchor = window.scrollY + 140;
      const currentSection = workspaceSections.reduce<{ id: string; anchor: string; label: string; offset: number }>((current, section) => {
        const element = document.getElementById(section.anchor);
        if (!element) {
          return current;
        }

        return element.offsetTop <= viewportAnchor && element.offsetTop > current.offset
          ? { ...section, offset: element.offsetTop }
          : current;
      }, { ...workspaceSections[0], offset: Number.NEGATIVE_INFINITY });

      setActiveWorkspaceSection(currentSection.id);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [projectData]);

  if (loadError) {
    return (
      <Stack gap={5}>
        <InlineNotification
          kind="error"
          title="Project could not load"
          subtitle={loadError}
          lowContrast
        />
        <Button onClick={() => window.location.reload()}>Reload project</Button>
      </Stack>
    );
  }

  if (loading || !projectData) {
    return <DataTableSkeleton rowCount={5} columnCount={5} />;
  }

  const assignedPmUser = users.find((user) => user.id === projectData.primaryPmUserId);
  const toRecipients = projectData.recipients.filter((recipient) => recipient.recipientType === "to");
  const ccRecipients = projectData.recipients.filter((recipient) => recipient.recipientType === "cc");
  const orderedMilestones = projectData.milestones
    .slice()
    .sort((left, right) => {
      const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }

      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.title.localeCompare(right.title);
    });
  const milestoneSummary = {
    total: orderedMilestones.length,
    completed: orderedMilestones.filter((milestone) => milestone.status === "completed").length,
    inProgress: orderedMilestones.filter((milestone) => milestone.status === "in_progress").length,
    atRisk: orderedMilestones.filter((milestone) => milestone.status === "at_risk").length,
  };
  const isCompletedProject = projectData.projectStage.toLowerCase() === "completed";
  const progressValue = projectData.progressPercent ?? (
    milestoneSummary.total ? Math.round((milestoneSummary.completed / milestoneSummary.total) * 100) : 0
  );
  const nextOpenMilestone =
    orderedMilestones.find((milestone) => milestone.status !== "completed" && milestone.dueDate) ??
    orderedMilestones.find((milestone) => milestone.status !== "completed") ??
    orderedMilestones[0] ??
    null;
  const activeWorkspaceTileDetails = activeWorkspaceTile
    ? {
        status: {
          heading: "Current status",
          content: (
            <Stack gap={5}>
              <div>
                <p className="app-workspace-tile__eyebrow">Status narrative</p>
                <p>{projectData.currentPosition || "No current status captured."}</p>
              </div>
              <div className="app-inline-actions">
                <span className="app-status-pill">{projectData.projectStage}</span>
                <Tag
                  type={loadProjectHealthTag(projectData.health)}
                  className={loadProjectHealthTagClassName(projectData.health)}
                >
                  {projectData.health}
                </Tag>
              </div>
              <div>
                <p className="app-workspace-tile__eyebrow">Delivery progress</p>
                <strong>{progressValue}%</strong>
                <ProgressBar label={`Delivery progress: ${progressValue}%`} value={progressValue} max={100} size="small" />
              </div>
            </Stack>
          ),
        },
        blocker: {
          heading: "Main blocker / risk",
          content: (
            <Stack gap={5}>
              <div>
                <p className="app-workspace-tile__eyebrow">Risk narrative</p>
                <p>{projectData.mainBlockerRisk || "No active blocker recorded."}</p>
              </div>
              <div>
                <p className="app-workspace-tile__eyebrow">Action owner</p>
                <p>{projectData.pendingWith ?? "Not specified"}</p>
              </div>
            </Stack>
          ),
        },
        steps: {
          heading: "Next steps",
          content: (
            <Stack gap={5}>
              <div>
                <p className="app-workspace-tile__eyebrow">Planned next action</p>
                <p>{projectData.keyNextAction || "No next steps captured."}</p>
              </div>
              <div>
                <p className="app-workspace-tile__eyebrow">Action owner</p>
                <p>{projectData.pendingWith ?? "Not specified"}</p>
              </div>
            </Stack>
          ),
        },
        milestone: {
          heading: "Next milestone",
          content: (
            <Stack gap={5}>
              <div>
                <p className="app-workspace-tile__eyebrow">Milestone</p>
                <p>{nextOpenMilestone?.title ?? projectData.nextMilestone ?? "No milestone captured."}</p>
              </div>
              <div>
                <p className="app-workspace-tile__eyebrow">Due date</p>
                <p>{formatDisplayDate(nextOpenMilestone?.dueDate ?? projectData.nextMilestoneDate) ?? "No due date"}</p>
              </div>
              {nextOpenMilestone?.owner ? (
                <div>
                  <p className="app-workspace-tile__eyebrow">Owner</p>
                  <p>{nextOpenMilestone.owner}</p>
                </div>
              ) : null}
              {nextOpenMilestone?.notes ? (
                <div>
                  <p className="app-workspace-tile__eyebrow">Notes</p>
                  <p>{nextOpenMilestone.notes}</p>
                </div>
              ) : null}
            </Stack>
          ),
        },
      }[activeWorkspaceTile]
    : null;

  async function syncMasterFromWeeklyUpdates() {
    setSyncingMaster(true);
    setSyncMasterMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/sync-master`, {
        method: "POST",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        project?: ProjectResponse["project"];
        error?: string;
      };

      if (!response.ok || !result.project) {
        throw new Error(result.error ?? "Unable to sync the master tracker.");
      }

      setProjectData(result.project);
      setSyncMasterMessage("Master tracker synced from weekly updates.");
    } catch (error) {
      setSyncMasterMessage(error instanceof Error ? error.message : "Unable to sync the master tracker.");
    } finally {
      setSyncingMaster(false);
    }
  }

  return (
    <div className="app-page">
      <section className="app-page__hero">
        <AppBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Projects", href: "/projects" },
            { label: `${projectData.projectCode} - ${projectData.projectName}` },
          ]}
        />
        <p className="app-page__eyebrow">Project detail</p>
        <h1 className="app-page__title">
          {projectData.projectCode} - {projectData.projectName}
        </h1>
        <p className="app-page__subtitle">
          Project workspace for status, next steps, delivery plan, risks, milestones, and reporting history.
        </p>
        <div className="app-inline-actions">
          <span className="app-status-pill">{projectData.projectStage}</span>
          <Tag
            type={loadProjectHealthTag(projectData.health)}
            className={loadProjectHealthTagClassName(projectData.health)}
          >
            {projectData.health}
          </Tag>
          <Tag type={loadProjectPriorityTag(projectData.priority)}>{projectData.priority}</Tag>
          <Button
            as="a"
            href={`/api/projects/${projectId}/report?cadence=weekly`}
            size="sm"
            kind="primary"
          >
            Download weekly PDF
          </Button>
          <Button
            as="a"
            href={`/api/projects/${projectId}/report?cadence=monthly`}
            size="sm"
            kind="secondary"
          >
            Download monthly PDF
          </Button>
          {canEdit ? (
            <>
              <Button
                kind={editingProject ? "secondary" : "tertiary"}
                size="sm"
                onClick={() => {
                  setEditingProject((current) => !current);
                  if (editingMilestones) {
                    setEditingMilestones(false);
                  }
                  if (editingRisks) {
                    setEditingRisks(false);
                  }
                }}
              >
                {editingProject ? "Close project editor" : "Edit project"}
              </Button>
              <Button
                kind={editingMilestones ? "secondary" : "tertiary"}
                size="sm"
                onClick={() => {
                  setEditingMilestones((current) => !current);
                  if (editingProject) {
                    setEditingProject(false);
                  }
                  if (editingRisks) {
                    setEditingRisks(false);
                  }
                }}
              >
                {editingMilestones ? "Close milestone editor" : "Edit milestones"}
              </Button>
              <Button
                kind={editingRisks ? "secondary" : "tertiary"}
                size="sm"
                onClick={() => {
                  setEditingRisks((current) => !current);
                  if (editingProject) {
                    setEditingProject(false);
                  }
                  if (editingMilestones) {
                    setEditingMilestones(false);
                  }
                }}
              >
                {editingRisks ? "Close risk editor" : "Edit risks"}
              </Button>
            </>
          ) : null}
        </div>
      </section>
      <nav className="app-workspace-nav" aria-label="Project workspace sections">
        {workspaceSections.map((section) => (
          <a
            key={section.id}
            href={`#${section.anchor}`}
            className={activeWorkspaceSection === section.id ? "app-workspace-nav__link--active" : undefined}
            aria-current={activeWorkspaceSection === section.id ? "true" : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (activeSectionUnlockTimerRef.current) {
                window.clearTimeout(activeSectionUnlockTimerRef.current);
              }
              activeSectionLockRef.current = section.id;
              setActiveWorkspaceSection(section.id);
              document.getElementById(section.anchor)?.scrollIntoView({
                block: "start",
                behavior: "smooth",
              });
              window.history.replaceState(null, "", `#${section.anchor}`);
              activeSectionUnlockTimerRef.current = window.setTimeout(() => {
                activeSectionLockRef.current = null;
                activeSectionUnlockTimerRef.current = null;
              }, 1200);
            }}
          >
            {section.label}
          </a>
        ))}
      </nav>
      <section id="workspace-overview" className="app-project-overview app-scroll-anchor" aria-label="Project workspace overview">
        <div className="app-project-profile">
          <div className="app-project-brief__header">
            <div>
              <p className="app-workspace-tile__eyebrow">About this project</p>
              <h2>{projectData.projectName}</h2>
            </div>
            <div className="app-inline-actions">
              <span className="app-status-pill">{projectData.projectStage}</span>
              <Tag
                type={loadProjectHealthTag(projectData.health)}
                className={loadProjectHealthTagClassName(projectData.health)}
              >
                {projectData.health}
              </Tag>
            </div>
          </div>
          <p>{projectData.projectDescription || "No project description captured yet."}</p>
        </div>
        <div className="app-workspace-modules">
          <Tile className="app-workspace-tile">
            <p className="app-workspace-tile__eyebrow">Current status</p>
            <div className="app-workspace-tile__content" id="workspace-tile-status">
              <div className="app-workspace-tile__body">
                <h2>{projectData.currentPosition || "No current status captured"}</h2>
                <div className="app-inline-actions">
                  <span className="app-status-pill">{projectData.projectStage}</span>
                  <Tag
                    type={loadProjectHealthTag(projectData.health)}
                    className={loadProjectHealthTagClassName(projectData.health)}
                  >
                    {projectData.health}
                  </Tag>
                </div>
                <div>
                  <strong>{progressValue}%</strong>
                  <ProgressBar label={`Delivery progress: ${progressValue}%`} value={progressValue} max={100} size="small" />
                </div>
              </div>
            </div>
            <Button
              kind="ghost"
              size="sm"
              className="app-workspace-tile__action"
              aria-haspopup="dialog"
              onClick={() => setActiveWorkspaceTile("status")}
            >
              Read more
            </Button>
          </Tile>
          <Tile className="app-workspace-tile">
            <div className="app-workspace-tile__icon"><WarningAlt size={20} /></div>
            <p className="app-workspace-tile__eyebrow">Main blocker / risk</p>
            <div className="app-workspace-tile__content" id="workspace-tile-blocker">
              <h2>{projectData.mainBlockerRisk || "No active blocker recorded"}</h2>
              <p>Owner: {projectData.pendingWith ?? "Not specified"}</p>
            </div>
            <Button
              kind="ghost"
              size="sm"
              className="app-workspace-tile__action"
              aria-haspopup="dialog"
              onClick={() => setActiveWorkspaceTile("blocker")}
            >
              Read more
            </Button>
          </Tile>
          <Tile className="app-workspace-tile">
            <div className="app-workspace-tile__icon"><Task size={20} /></div>
            <p className="app-workspace-tile__eyebrow">Next steps</p>
            <div className="app-workspace-tile__content" id="workspace-tile-steps">
              <h2>{projectData.keyNextAction || "No next steps captured"}</h2>
              <p>Owner: {projectData.pendingWith ?? "Not specified"}</p>
            </div>
            <Button
              kind="ghost"
              size="sm"
              className="app-workspace-tile__action"
              aria-haspopup="dialog"
              onClick={() => setActiveWorkspaceTile("steps")}
            >
              Read more
            </Button>
          </Tile>
          <Tile className="app-workspace-tile">
            <div className="app-workspace-tile__icon"><Milestone size={20} /></div>
            <p className="app-workspace-tile__eyebrow">Next milestone</p>
            <div className="app-workspace-tile__content" id="workspace-tile-milestone">
              <h2>{nextOpenMilestone?.title ?? projectData.nextMilestone ?? "No milestone captured"}</h2>
              <p>{formatDisplayDate(nextOpenMilestone?.dueDate ?? projectData.nextMilestoneDate) ?? "No due date"}</p>
            </div>
            <Button
              kind="ghost"
              size="sm"
              className="app-workspace-tile__action"
              aria-haspopup="dialog"
              onClick={() => setActiveWorkspaceTile("milestone")}
            >
              Read more
            </Button>
          </Tile>
        </div>
        <Modal
          open={Boolean(activeWorkspaceTileDetails)}
          passiveModal
          hasScrollingContent
          size="lg"
          modalLabel={`${projectData.projectCode} - ${projectData.projectName}`}
          modalHeading={activeWorkspaceTileDetails?.heading}
          modalAriaLabel={activeWorkspaceTileDetails?.heading ?? "Project detail"}
          onRequestClose={() => setActiveWorkspaceTile(null)}
        >
          {activeWorkspaceTileDetails?.content}
        </Modal>
      </section>
      {editingProject ? (
        <ProjectForm
          mode="edit"
          initialProject={projectData}
          lookups={lookups}
          users={users}
          onSaved={() => {
            startTransition(() => setLoading(true));
            void (async () => {
              const result = await loadProjectPayload(projectId);
              startTransition(() => {
                setProjectData(result.project);
                setLookups(result.lookups);
                setUsers(result.users);
                setEditingProject(false);
                setLoading(false);
              });
            })();
          }}
        />
      ) : (
        <div className="app-stack">
          <section id="snapshot" className="app-card app-stack app-scroll-anchor">
            <div className="app-card__header">
              <div>
                <h2 className="app-card__title">Project snapshot</h2>
                <p className="app-helper-text">
                  Current tracker summary for governance, delivery, and schedule visibility.
                </p>
              </div>
            </div>
            <div className="app-detail-grid">
              <div className="app-detail-field">
                <p className="app-detail-field__label">Project ID</p>
                <p className="app-detail-field__value">{projectData.projectCode}</p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Project Name</p>
                <p className="app-detail-field__value">{projectData.projectName}</p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Project Stage</p>
                <p className="app-detail-field__value">{projectData.projectStage}</p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Progress %</p>
                <ProgressGauge value={projectData.progressPercent} />
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Health</p>
                <div className="app-inline-actions">
                  <Tag
                    type={loadProjectHealthTag(projectData.health)}
                    className={loadProjectHealthTagClassName(projectData.health)}
                  >
                    {projectData.health}
                  </Tag>
                </div>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Priority</p>
                <div className="app-inline-actions">
                  <Tag type={loadProjectPriorityTag(projectData.priority)}>{projectData.priority}</Tag>
                </div>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Reporting cadence</p>
                <p className="app-detail-field__value">{projectData.updateFrequency}</p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">PM name</p>
                <p className="app-detail-field__value">{projectData.pmName || "Not specified"}</p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Project sponsor</p>
                <p className="app-detail-field__value">
                  {projectData.projectSponsor || "Not specified"}
                </p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Assigned PM user</p>
                <p className="app-detail-field__value">
                  {assignedPmUser ? `${assignedPmUser.name} (${assignedPmUser.email})` : "Not assigned"}
                </p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Start date</p>
                <p className="app-detail-field__value">
                  {formatDisplayDate(projectData.startDate) ?? "Not scheduled"}
                </p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Planned end date</p>
                <p className="app-detail-field__value">
                  {formatDisplayDate(projectData.endDate) ?? "Not scheduled"}
                </p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Actual end date</p>
                <p className="app-detail-field__value">
                  {formatDisplayDate(projectData.actualEndDate) ?? "Not completed"}
                </p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Schedule variance</p>
                <p className="app-detail-field__value">
                  {formatScheduleVariance(projectData.endDate, projectData.actualEndDate)}
                </p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Currency</p>
                <p className="app-detail-field__value">{projectData.budgetCurrency || "AED"}</p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Contract value</p>
                <p className="app-detail-field__value">
                  {formatMoney(projectData.contractValue, projectData.budgetCurrency)}
                </p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Actual spend to date</p>
                <p className="app-detail-field__value">
                  {formatMoney(projectData.actualSpendToDate, projectData.budgetCurrency)}
                </p>
              </div>
              <div className="app-detail-field">
                <p className="app-detail-field__label">Last updated</p>
                <p className="app-detail-field__value">
                  {formatDisplayDate(projectData.lastUpdated) ?? "Not updated"}
                </p>
              </div>
            </div>
          </section>
          <section id="delivery" className="app-card app-stack app-scroll-anchor">
            <div className="app-card__header">
              <div>
                <h2 className="app-card__title">
                  {isCompletedProject ? "Completed project narrative" : "Current delivery narrative"}
                </h2>
                <p className="app-helper-text">
                  {isCompletedProject
                    ? "Closure summary, completed deliverables, residual notes, and communication controls."
                    : "Delivery position, next actions, blockers, and communication controls."}
                </p>
              </div>
              {canEdit && !isCompletedProject ? (
                <Button
                  kind="secondary"
                  size="sm"
                  disabled={syncingMaster}
                  onClick={syncMasterFromWeeklyUpdates}
                >
                  {syncingMaster ? "Syncing..." : "Sync Master"}
                </Button>
              ) : null}
            </div>
            {syncMasterMessage ? (
              <InlineNotification
                kind={syncMasterMessage.includes("synced") ? "success" : "error"}
                title={syncMasterMessage.includes("synced") ? "Master synced" : "Sync failed"}
                subtitle={syncMasterMessage}
                lowContrast
              />
            ) : null}
            <div className="app-stack">
              <div className="app-detail-section">
                <p className="app-detail-field__label">
                  {isCompletedProject ? "Closure summary" : "Current status"}
                </p>
                <p className="app-detail-field__value">
                  {projectData.currentPosition ?? "No current status captured yet."}
                </p>
              </div>
              <div className="app-detail-section">
                <p className="app-detail-field__label">
                  {isCompletedProject ? "Completed deliverables" : "Next steps"}
                </p>
                <p className="app-detail-field__value">
                  {projectData.keyNextAction ??
                    (isCompletedProject
                      ? "No completed deliverables captured yet."
                      : "No next steps captured yet.")}
                </p>
              </div>
              <div className="app-detail-section">
                <p className="app-detail-field__label">
                  {isCompletedProject ? "Closure notes / residual risks" : "Main blocker / risk"}
                </p>
                <p className="app-detail-field__value">
                  {projectData.mainBlockerRisk ?? "No active blocker recorded."}
                </p>
              </div>
              <div className="app-detail-grid">
                <div className="app-detail-field">
                  <p className="app-detail-field__label">Action owner</p>
                  <p className="app-detail-field__value">{projectData.pendingWith ?? "Not specified"}</p>
                </div>
                <div className="app-detail-field">
                  <p className="app-detail-field__label">Next milestone snapshot</p>
                  <p className="app-detail-field__value">
                    {projectData.nextMilestone ?? "No milestone snapshot"}
                  </p>
                </div>
                <div className="app-detail-field">
                  <p className="app-detail-field__label">Next milestone date</p>
                  <p className="app-detail-field__value">
                    {formatDisplayDate(projectData.nextMilestoneDate) ?? "No date"}
                  </p>
                </div>
                <div className="app-detail-field">
                  <p className="app-detail-field__label">Weekly emails</p>
                  <p className="app-detail-field__value">
                    {projectData.weeklyEmailEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div className="app-detail-field">
                  <p className="app-detail-field__label">Monthly emails</p>
                  <p className="app-detail-field__value">
                    {projectData.monthlyEmailEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
              <div className="app-detail-section">
                <p className="app-detail-field__label">To recipients</p>
                <p className="app-detail-field__value">
                  {toRecipients.length
                    ? toRecipients.map((recipient) => recipient.email).join(", ")
                    : "No To recipients configured"}
                </p>
              </div>
              <div className="app-detail-section">
                <p className="app-detail-field__label">CC recipients</p>
                <p className="app-detail-field__value">
                  {ccRecipients.length
                    ? ccRecipients.map((recipient) => recipient.email).join(", ")
                    : "No CC recipients configured"}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
      {editingRisks ? (
        <ProjectRiskManager
          projectId={projectId}
          initialRisks={projectData.risks}
          onSaved={() => {
            startTransition(() => setLoading(true));
            void (async () => {
              const result = await loadProjectPayload(projectId);
              startTransition(() => {
                setProjectData(result.project);
                setLookups(result.lookups);
                setUsers(result.users);
                setEditingRisks(false);
                setLoading(false);
              });
            })();
          }}
        />
      ) : (
        <section id="risks" className="app-card app-stack app-scroll-anchor">
          <div className="app-card__header">
            <div>
              <h2 className="app-card__title">Risks & issues</h2>
              <p className="app-helper-text">
                Structured project risk register with owner, mitigation plan, severity, and target dates.
              </p>
            </div>
            <div className="app-inline-actions">
              <Tag type="cool-gray" className="app-milestone-tag app-milestone-tag--total">
                {projectData.risks.length} total
              </Tag>
              <Tag type="red" className="app-risk-tag app-risk-tag--open">
                {projectData.risks.filter((risk) => risk.status === "open").length} open
              </Tag>
              <Tag type="cool-gray" className="app-risk-tag app-risk-tag--monitoring">
                {projectData.risks.filter((risk) => risk.status === "monitoring").length} monitoring
              </Tag>
              <Tag type="teal" className="app-risk-tag app-risk-tag--mitigated">
                {projectData.risks.filter((risk) => risk.status === "mitigated").length} mitigated
              </Tag>
              <Tag type="green" className="app-risk-tag app-risk-tag--closed">
                {projectData.risks.filter((risk) => risk.status === "closed").length} closed
              </Tag>
            </div>
          </div>
          {projectData.risks.length ? (
            <div className="app-table-wrap">
              <Table size="md" useZebraStyles>
                <TableHead>
                  <TableRow>
                    <TableHeader>ID</TableHeader>
                    <TableHeader>Risk / Issue</TableHeader>
                    <TableHeader>Owner</TableHeader>
                    <TableHeader>Mitigation / Action Plan</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Severity</TableHeader>
                    <TableHeader>Target Date</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projectData.risks
                    .slice()
                    .sort((left, right) => {
                      if (left.sortOrder !== right.sortOrder) {
                        return left.sortOrder - right.sortOrder;
                      }

                      return (left.targetDate ?? "").localeCompare(right.targetDate ?? "");
                    })
                    .map((risk, index) => (
                      <TableRow key={risk.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <strong>{risk.title}</strong>
                          <div className="app-helper-text">{risk.description}</div>
                        </TableCell>
                        <TableCell>{risk.owner || "Not assigned"}</TableCell>
                        <TableCell>{risk.mitigationPlan || "No mitigation plan recorded."}</TableCell>
                        <TableCell>
                          <Tag
                            type={loadRiskStatusTag(risk.status)}
                            className={loadRiskStatusTagClassName(risk.status)}
                          >
                            {formatRiskLabel(risk.status)}
                          </Tag>
                        </TableCell>
                        <TableCell>
                          <Tag
                            type={loadRiskSeverityTag(risk.severity)}
                            className={loadRiskSeverityTagClassName(risk.severity)}
                          >
                            {formatRiskLabel(risk.severity)}
                          </Tag>
                        </TableCell>
                        <TableCell>{formatDisplayDate(risk.targetDate) ?? "No target date"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="app-empty-state">No risks are currently recorded for this project.</div>
          )}
        </section>
      )}
      {editingMilestones ? (
        <MilestoneManager
          projectId={projectId}
          initialMilestones={projectData.milestones}
          onSaved={() => {
            startTransition(() => setLoading(true));
            void (async () => {
              const result = await loadProjectPayload(projectId);
              startTransition(() => {
                setProjectData(result.project);
                setLookups(result.lookups);
                setUsers(result.users);
                setEditingMilestones(false);
                setLoading(false);
              });
            })();
          }}
        />
      ) : (
        <section id="milestones" className="app-card app-stack app-scroll-anchor">
          <div className="app-card__header">
            <div>
              <h2 className="app-card__title">Milestones</h2>
              <p className="app-helper-text">
                Ordered delivery milestones driving the current next-milestone snapshot.
              </p>
            </div>
            <div className="app-inline-actions">
              <Tag type="cool-gray" className="app-milestone-tag app-milestone-tag--total">
                {milestoneSummary.total} total
              </Tag>
              <Tag type="green" className={loadMilestoneStatusTagClassName("completed")}>
                {milestoneSummary.completed} completed
              </Tag>
              <Tag type="blue" className={loadMilestoneStatusTagClassName("in_progress")}>
                {milestoneSummary.inProgress} in progress
              </Tag>
              <Tag type="red" className={loadMilestoneStatusTagClassName("at_risk")}>
                {milestoneSummary.atRisk} at risk
              </Tag>
            </div>
          </div>
          {orderedMilestones.length ? (
            <div className="app-table-wrap">
              <Table size="md" useZebraStyles>
                <TableHead>
                  <TableRow>
                    <TableHeader>S/N</TableHeader>
                    <TableHeader>Milestone</TableHeader>
                    <TableHeader>Due date</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Owner</TableHeader>
                    <TableHeader>Summary</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderedMilestones.map((milestone, index) => (
                    <TableRow key={milestone.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{milestone.title}</TableCell>
                      <TableCell>{formatDisplayDate(milestone.dueDate) ?? "No due date"}</TableCell>
                      <TableCell>
                        <Tag
                          type={loadMilestoneStatusTag(milestone.status)}
                          className={loadMilestoneStatusTagClassName(milestone.status)}
                        >
                          {formatMilestoneStatus(milestone.status)}
                        </Tag>
                      </TableCell>
                      <TableCell>{milestone.owner || "Not assigned"}</TableCell>
                      <TableCell>{compactNotes(milestone.notes) || "No notes"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="app-empty-state">
              No milestones recorded for this project yet.
            </div>
          )}
        </section>
      )}
      <section id="weekly-history" className="app-card app-stack app-scroll-anchor">
        <div className="app-card__header">
          <div>
            <h2 className="app-card__title">
              {isCompletedProject ? "Closure record" : "Weekly history"}
            </h2>
            <p className="app-helper-text">
              {isCompletedProject
                ? "Completed projects show their closure summary and final delivery record here."
                : "Imported workbook updates and new web submissions are both listed here."}
            </p>
          </div>
          <div className="app-inline-actions">
            <Tag type={isCompletedProject ? "green" : "cyan"}>
              {isCompletedProject
                ? projectData.weeklyUpdates.length
                  ? "Closure captured"
                  : "No closure record"
                : `${projectData.weeklyUpdates.length} weekly update${projectData.weeklyUpdates.length === 1 ? "" : "s"}`}
            </Tag>
          </div>
        </div>
        {isCompletedProject ? (
          <div className="app-table-wrap">
            <Table size="md" useZebraStyles>
              <TableHead>
                <TableRow>
                  <TableHeader>Closure date</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Closure summary</TableHeader>
                  <TableHeader>Completed deliverables</TableHeader>
                  <TableHeader>Closure notes / residual risks</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {(projectData.weeklyUpdates.length ? projectData.weeklyUpdates.slice(0, 1) : []).map((update) => (
                  <TableRow key={update.id}>
                    <TableCell>
                      {formatDisplayDate(update.updateDate) ?? update.updateDate}
                    </TableCell>
                    <TableCell>
                      <Tag
                        type={loadProjectHealthTag(update.health)}
                        className={loadProjectHealthTagClassName(update.health)}
                      >
                        {update.stage} / {update.health}
                      </Tag>
                    </TableCell>
                    <TableCell>{projectData.currentPosition ?? update.whatHappened}</TableCell>
                    <TableCell>{projectData.keyNextAction ?? update.nextStep}</TableCell>
                    <TableCell>{projectData.mainBlockerRisk ?? update.helpNeeded ?? "No residual risks recorded."}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!projectData.weeklyUpdates.length ? (
              <div className="app-empty-state">
                No closure record has been captured for this completed project yet.
              </div>
            ) : null}
          </div>
        ) : projectData.weeklyUpdates.length ? (
          <div className="app-table-wrap">
            <Table size="md" useZebraStyles>
              <TableHead>
                <TableRow>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Stage</TableHeader>
                  <TableHeader>Health</TableHeader>
                  <TableHeader>Current Status</TableHeader>
                  <TableHeader>What Happened</TableHeader>
                  <TableHeader>Next Step</TableHeader>
                  <TableHeader>Blocker</TableHeader>
                  <TableHeader>Help Needed</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectData.weeklyUpdates.map((update) => (
                  <TableRow key={update.id}>
                    <TableCell>
                      {formatDisplayDate(update.updateDate) ?? update.updateDate}
                    </TableCell>
                    <TableCell>{update.stage}</TableCell>
                    <TableCell>
                      <Tag
                        type={loadProjectHealthTag(update.health)}
                        className={loadProjectHealthTagClassName(update.health)}
                      >
                        {update.health}
                      </Tag>
                    </TableCell>
                    <TableCell>{update.currentPosition ?? "Not captured"}</TableCell>
                    <TableCell>{update.whatHappened}</TableCell>
                    <TableCell>{update.nextStep}</TableCell>
                    <TableCell>{update.blocker ?? "None"}</TableCell>
                    <TableCell>{update.helpNeeded ?? "None"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="app-empty-state">
            No weekly updates have been imported or submitted for this project yet.
          </div>
        )}
      </section>
    </div>
  );
}
