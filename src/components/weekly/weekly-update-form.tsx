"use client";

import { useEffect, useState } from "react";
import {
  Button,
  InlineLoading,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from "@carbon/react";

import { formatDisplayDate } from "@/lib/utils/format";

type ProjectOption = {
  id: string;
  projectCode: string;
  projectName: string;
  projectStage: string;
  health: string;
  progressPercent?: number | null;
  managementUpdate?: string | null;
  pendingWith?: string | null;
  nextMilestone?: string | null;
  nextMilestoneDate?: string | null;
  milestones?: MilestoneReview[];
};

type MilestoneReview = {
  id: string;
  title: string;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
  completedAt?: string | null;
};

const milestoneStatuses = [
  { label: "Planned", value: "planned" },
  { label: "In progress", value: "in_progress" },
  { label: "At risk", value: "at_risk" },
  { label: "Completed", value: "completed" },
];

function dateOnly(value?: string | null) {
  return value?.slice(0, 10) ?? "";
}

function readFieldValue(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  return event.target.value;
}

function isLastFridayBeforeMonthEnd(value: string) {
  if (!value) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const selected = new Date(year, month - 1, day);

  if (Number.isNaN(selected.getTime()) || selected.getDay() !== 5) {
    return false;
  }

  const lastDay = new Date(year, month, 0);
  const lastFriday = new Date(lastDay);
  lastFriday.setDate(lastDay.getDate() - ((lastDay.getDay() + 2) % 7));

  return selected.toDateString() === lastFriday.toDateString();
}

export function WeeklyUpdateForm() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [lookups, setLookups] = useState<Record<string, string[]>>({});
  const [milestoneReviews, setMilestoneReviews] = useState<MilestoneReview[]>([]);
  const [form, setForm] = useState({
    projectId: "",
    updateDate: new Date().toISOString().slice(0, 10),
    stage: "",
    health: "",
    progressPercent: "",
    managementUpdate: "",
    currentPosition: "",
    whatHappened: "",
    nextStep: "",
    blocker: "",
    pendingWith: "",
    nextMilestone: "",
    nextMilestoneDate: "",
    helpNeeded: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/projects?view=weekly");
        if (!response.ok) throw new Error();
        const result = (await response.json()) as {
          projects: ProjectOption[];
          lookups: Record<string, string[]>;
        };
        setProjects(result.projects ?? []);
        setLookups(result.lookups ?? {});
      } catch {
        setMessage("Projects could not be loaded. Refresh the page and try again.");
      }
    })();
  }, []);

  const selectedProject = projects.find((project) => project.id === form.projectId);
  const requiresMilestoneReview = isLastFridayBeforeMonthEnd(form.updateDate);
  const activeMilestoneReviews = milestoneReviews.filter(
    (milestone) => milestone.status !== "completed",
  );

  function selectProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    const milestones = project?.milestones ?? [];

    setForm((current) => ({
      ...current,
      projectId,
      stage: project?.projectStage ?? "",
      health: project?.health ?? "",
      progressPercent:
        project?.progressPercent === null || project?.progressPercent === undefined
          ? ""
          : String(project.progressPercent),
      managementUpdate: project?.managementUpdate ?? "",
      currentPosition: "",
      pendingWith: project?.pendingWith ?? "",
      nextMilestone: project?.nextMilestone ?? "",
      nextMilestoneDate: project?.nextMilestoneDate?.slice(0, 10) ?? "",
    }));
    setMilestoneReviews(
      milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        status: milestone.status,
        dueDate: dateOnly(milestone.dueDate),
        completedAt: dateOnly(milestone.completedAt),
        notes: milestone.notes ?? "",
      })),
    );
  }

  function updateMilestoneReview(
    milestoneId: string,
    field: keyof MilestoneReview,
    value: string,
  ) {
    setMilestoneReviews((current) =>
      current.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, [field]: value } : milestone,
      ),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/weekly-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          progressPercent: form.progressPercent === "" ? null : Number(form.progressPercent),
          nextMilestoneDate: form.nextMilestoneDate || undefined,
          milestoneReviews: requiresMilestoneReview ? milestoneReviews : [],
        }),
      });
      const result = (await response.json()) as { error?: string; syncedProjectMaster?: boolean };
      if (!response.ok) {
        setMessage(result.error ?? "Unable to submit weekly update.");
        return;
      }

      setMessage(result.syncedProjectMaster
        ? "Weekly update submitted and project snapshot synced."
        : "Historical update saved to weekly history.");
      setForm((current) => ({
        ...current,
        currentPosition: "",
        whatHappened: "",
        nextStep: "",
        blocker: "",
        helpNeeded: "",
      }));
    } catch {
      setMessage("Unable to submit weekly update. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="app-card app-stack">
      <div className="app-card__header">
        <div>
          <h3 className="app-card__title">Weekly PM submission</h3>
          <p className="app-helper-text">
            Each submission adds to weekly history. The latest update also refreshes the project snapshot.
          </p>
        </div>
      </div>
      <div className="app-form-grid">
        <Select
          id="projectId"
          labelText="Project"
          value={form.projectId}
          required
          onChange={(event) => selectProject(readFieldValue(event))}
        >
          <SelectItem text="Select project" value="" />
          {projects.map((project) => (
            <SelectItem
              key={project.id}
              text={`${project.projectCode} - ${project.projectName}`}
              value={project.id}
            />
          ))}
        </Select>
        <TextInput
          id="projectName"
          labelText="Project Name"
          value={selectedProject?.projectName ?? ""}
          readOnly
        />
        <TextInput
          id="updateDate"
          labelText="Update Date"
          type="date"
          helperText={formatDisplayDate(form.updateDate) ?? "Select the reporting date"}
          value={form.updateDate}
          required
          onChange={(event) => {
            const value = readFieldValue(event);
            setForm((current) => ({ ...current, updateDate: value }));
          }}
        />
        <Select
          id="stage"
          labelText="Stage"
          value={form.stage}
          required
          onChange={(event) => {
            const value = readFieldValue(event);
            setForm((current) => ({
              ...current,
              stage: value,
              progressPercent:
                value.trim().toLowerCase() === "completed"
                  ? "100"
                  : current.progressPercent,
            }));
          }}
        >
          <SelectItem text="Select stage" value="" />
          {(lookups.project_stage ?? []).map((value) => (
            <SelectItem key={value} text={value} value={value} />
          ))}
        </Select>
        <Select
          id="health"
          labelText="Health"
          value={form.health}
          required
          onChange={(event) => {
            const value = readFieldValue(event);
            setForm((current) => ({ ...current, health: value }));
          }}
        >
          <SelectItem text="Select health" value="" />
          {(lookups.health ?? []).map((value) => (
            <SelectItem key={value} text={value} value={value} />
          ))}
        </Select>
        <TextInput
          id="progressPercent"
          labelText="Progress (%)"
          type="number"
          min={0}
          max={100}
          step={1}
          value={form.progressPercent}
          readOnly={form.stage.trim().toLowerCase() === "completed"}
          helperText={
            form.stage.trim().toLowerCase() === "completed"
              ? "Completed projects are automatically set to 100%."
              : "Enter a value from 0 to 100 if known."
          }
          onChange={(event) => {
            const value = readFieldValue(event);
            setForm((current) => ({ ...current, progressPercent: value }));
          }}
        />
      </div>
      <TextArea
        id="managementUpdate"
        labelText="Management Update"
        helperText="This summary appears on the project-status card."
        rows={4}
        value={form.managementUpdate}
        onChange={(event) => {
          const value = readFieldValue(event);
          setForm((current) => ({ ...current, managementUpdate: value }));
        }}
      />
      <TextArea
        id="currentPosition"
        labelText="Current Status"
        rows={4}
        value={form.currentPosition}
        required
        onChange={(event) => {
          const value = readFieldValue(event);
          setForm((current) => ({ ...current, currentPosition: value }));
        }}
      />
      <TextArea
        id="whatHappened"
        labelText="What Happened"
        rows={5}
        value={form.whatHappened}
        required
        onChange={(event) => {
          const value = readFieldValue(event);
          setForm((current) => ({ ...current, whatHappened: value }));
        }}
      />
      <TextArea
        id="nextStep"
        labelText="What Will Happen This Week"
        rows={4}
        value={form.nextStep}
        required
        onChange={(event) => {
          const value = readFieldValue(event);
          setForm((current) => ({ ...current, nextStep: value }));
        }}
      />
      <TextArea
        id="blocker"
        labelText="Main Blocker / Risk"
        rows={3}
        value={form.blocker}
        onChange={(event) => {
          const value = readFieldValue(event);
          setForm((current) => ({ ...current, blocker: value }));
        }}
      />
      <div className="app-form-grid">
        <TextInput
          id="pendingWith"
          labelText="Current action owner"
          value={form.pendingWith}
          onChange={(event) => {
            const value = readFieldValue(event);
            setForm((current) => ({ ...current, pendingWith: value }));
          }}
        />
        <TextInput
          id="nextMilestone"
          labelText="Next Milestone"
          value={form.nextMilestone}
          onChange={(event) => {
            const value = readFieldValue(event);
            setForm((current) => ({ ...current, nextMilestone: value, nextMilestoneDate: "" }));
          }}
        />
        <TextInput
          id="nextMilestoneDate"
          labelText="Next Milestone Date"
          type="date"
          helperText={formatDisplayDate(form.nextMilestoneDate) ?? "Optional milestone date"}
          value={form.nextMilestoneDate}
          onChange={(event) => {
            const value = readFieldValue(event);
            setForm((current) => ({ ...current, nextMilestoneDate: value }));
          }}
        />
      </div>
      <TextArea
        id="helpNeeded"
        labelText="Support Needed from Program Manager"
        rows={3}
        value={form.helpNeeded}
        onChange={(event) => {
          const value = readFieldValue(event);
          setForm((current) => ({ ...current, helpNeeded: value }));
        }}
      />
      {requiresMilestoneReview ? (
        <section className="app-milestone-review-section app-stack" aria-label="Monthly milestone review">
          <div className="app-card__header">
            <div>
              <h3 className="app-card__title">Monthly milestone review</h3>
              <p className="app-helper-text">
                This update date is the last Friday before month end. Update only active milestones that changed this month.
              </p>
            </div>
          </div>
          {!selectedProject ? (
            <p className="app-helper-text">Select a project to review its milestones.</p>
          ) : activeMilestoneReviews.length ? (
            <div className="app-milestone-review-list">
              <div className="app-milestone-review-row app-milestone-review-row--header">
                <span>Milestone</span>
                <span>Status</span>
                <span>Due date</span>
                <span>Completion date</span>
              </div>
              {activeMilestoneReviews.map((milestone) => (
                <div key={milestone.id} className="app-milestone-review-row">
                  <div className="app-milestone-review-title">
                    <strong>{milestone.title}</strong>
                    {milestone.notes ? <span>{milestone.notes}</span> : null}
                  </div>
                  <div>
                    <Select
                      id={`milestone-status-${milestone.id}`}
                      labelText="Status"
                      hideLabel
                      value={milestone.status}
                      onChange={(event) =>
                        updateMilestoneReview(milestone.id, "status", readFieldValue(event))
                      }
                    >
                      {milestoneStatuses.map((status) => (
                        <SelectItem key={status.value} text={status.label} value={status.value} />
                      ))}
                    </Select>
                  </div>
                  <div>
                    <TextInput
                      id={`milestone-due-${milestone.id}`}
                      labelText="Due Date"
                      hideLabel
                      type="date"
                      value={milestone.dueDate ?? ""}
                      onChange={(event) =>
                        updateMilestoneReview(milestone.id, "dueDate", readFieldValue(event))
                      }
                    />
                  </div>
                  <div>
                    <TextInput
                      id={`milestone-completed-${milestone.id}`}
                      labelText="Completion Date"
                      hideLabel
                      type="date"
                      value={milestone.completedAt ?? ""}
                      disabled={milestone.status !== "completed"}
                      onChange={(event) =>
                        updateMilestoneReview(milestone.id, "completedAt", readFieldValue(event))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="app-helper-text">All recorded milestones are completed for this project.</p>
          )}
        </section>
      ) : null}
      <div className="app-inline-actions">
        <Button type="submit" disabled={submitting}>
          Submit weekly update
        </Button>
        {submitting ? <InlineLoading description="Submitting..." /> : null}
        {message ? <p className="app-helper-text">{message}</p> : null}
      </div>
    </form>
  );
}
