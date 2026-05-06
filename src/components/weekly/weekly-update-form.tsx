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
  pendingWith?: string | null;
  nextMilestone?: string | null;
  nextMilestoneDate?: string | null;
};

export function WeeklyUpdateForm() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [lookups, setLookups] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({
    projectId: "",
    updateDate: new Date().toISOString().slice(0, 10),
    stage: "",
    health: "",
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
      const response = await fetch("/api/projects");
      const result = (await response.json()) as {
        projects: ProjectOption[];
        lookups: Record<string, string[]>;
      };
      setProjects(result.projects ?? []);
      setLookups(result.lookups ?? {});
    })();
  }, []);

  const selectedProject = projects.find((project) => project.id === form.projectId);

  function selectProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId);

    setForm((current) => ({
      ...current,
      projectId,
      stage: project?.projectStage ?? "",
      health: project?.health ?? "",
      currentPosition: "",
      pendingWith: project?.pendingWith ?? "",
      nextMilestone: project?.nextMilestone ?? "",
      nextMilestoneDate: project?.nextMilestoneDate?.slice(0, 10) ?? "",
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/weekly-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSubmitting(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setMessage(result.error ?? "Unable to submit weekly update.");
      return;
    }

    setMessage("Weekly update submitted and master tracker snapshot synced.");
    setForm((current) => ({
      ...current,
      currentPosition: "",
      whatHappened: "",
      nextStep: "",
      blocker: "",
      helpNeeded: "",
    }));
  }

  return (
    <form onSubmit={handleSubmit} className="app-card app-stack">
      <div className="app-card__header">
        <div>
          <h3 className="app-card__title">Weekly PM submission</h3>
          <p className="app-helper-text">
            Each submission creates history and refreshes the current project snapshot automatically.
          </p>
        </div>
      </div>
      <div className="app-form-grid">
        <Select
          id="projectId"
          labelText="Project"
          value={form.projectId}
          onChange={(event) => selectProject(event.currentTarget.value)}
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
          onChange={(event) =>
            setForm((current) => ({ ...current, updateDate: event.currentTarget.value }))
          }
        />
        <Select
          id="stage"
          labelText="Stage"
          value={form.stage}
          onChange={(event) => setForm((current) => ({ ...current, stage: event.currentTarget.value }))}
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
          onChange={(event) => setForm((current) => ({ ...current, health: event.currentTarget.value }))}
        >
          <SelectItem text="Select health" value="" />
          {(lookups.health ?? []).map((value) => (
            <SelectItem key={value} text={value} value={value} />
          ))}
        </Select>
      </div>
      <TextArea
        id="currentPosition"
        labelText="Current Status"
        rows={4}
        value={form.currentPosition}
        onChange={(event) =>
          setForm((current) => ({ ...current, currentPosition: event.currentTarget.value }))
        }
      />
      <TextArea
        id="whatHappened"
        labelText="What Happened"
        rows={5}
        value={form.whatHappened}
        onChange={(event) =>
          setForm((current) => ({ ...current, whatHappened: event.currentTarget.value }))
        }
      />
      <TextArea
        id="nextStep"
        labelText="What Will Happen This Week"
        rows={4}
        value={form.nextStep}
        onChange={(event) =>
          setForm((current) => ({ ...current, nextStep: event.currentTarget.value }))
        }
      />
      <TextArea
        id="blocker"
        labelText="Main Blocker / Risk"
        rows={3}
        value={form.blocker}
        onChange={(event) =>
          setForm((current) => ({ ...current, blocker: event.currentTarget.value }))
        }
      />
      <div className="app-form-grid">
        <TextInput
          id="pendingWith"
          labelText="Current action owner"
          value={form.pendingWith}
          onChange={(event) =>
            setForm((current) => ({ ...current, pendingWith: event.currentTarget.value }))
          }
        />
        <TextInput
          id="nextMilestone"
          labelText="Next Milestone"
          value={form.nextMilestone}
          onChange={(event) =>
            setForm((current) => ({ ...current, nextMilestone: event.currentTarget.value }))
          }
        />
        <TextInput
          id="nextMilestoneDate"
          labelText="Next Milestone Date"
          type="date"
          helperText={formatDisplayDate(form.nextMilestoneDate) ?? "Optional milestone date"}
          value={form.nextMilestoneDate}
          onChange={(event) =>
            setForm((current) => ({ ...current, nextMilestoneDate: event.currentTarget.value }))
          }
        />
      </div>
      <TextArea
        id="helpNeeded"
        labelText="Support Needed from Program Manager"
        rows={3}
        value={form.helpNeeded}
        onChange={(event) =>
          setForm((current) => ({ ...current, helpNeeded: event.currentTarget.value }))
        }
      />
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
