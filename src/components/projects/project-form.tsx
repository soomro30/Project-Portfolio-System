"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  InlineLoading,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from "@carbon/react";

import { formatDisplayDate } from "@/lib/utils/format";

type LookupMap = Record<string, string[]>;

type ProjectRecord = {
  id?: string;
  projectCode: string;
  projectName: string;
  projectStage: string;
  pmName: string;
  projectSponsor?: string | null;
  projectDescription?: string | null;
  progressPercent?: number | string | null;
  health: string;
  priority: string;
  currentPosition?: string | null;
  keyNextAction?: string | null;
  pendingWith?: string | null;
  mainBlockerRisk?: string | null;
  managementUpdate?: string | null;
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
  recipients?: Array<{ email: string; recipientType: "to" | "cc"; name?: string | null }>;
};

const emptyProject: ProjectRecord = {
  projectCode: "",
  projectName: "",
  projectStage: "",
  pmName: "",
  projectSponsor: "",
  projectDescription: "",
  progressPercent: "",
  health: "",
  priority: "",
  currentPosition: "",
  keyNextAction: "",
  pendingWith: "",
  mainBlockerRisk: "",
  managementUpdate: "",
  nextMilestone: "",
  nextMilestoneDate: "",
  lastUpdated: "",
  updateFrequency: "",
  startDate: "",
  endDate: "",
  actualEndDate: "",
  budgetCurrency: "AED",
  contractValue: "",
  actualSpendToDate: "",
  primaryPmUserId: "",
  weeklyEmailEnabled: true,
  monthlyEmailEnabled: true,
  recipients: [],
};

function recipientsToText(
  recipients: ProjectRecord["recipients"],
  type: "to" | "cc",
) {
  return (recipients ?? [])
    .filter((recipient) => recipient.recipientType === type)
    .map((recipient) => recipient.email)
    .join("\n");
}

function parseRecipients(text: string, type: "to" | "cc") {
  return text
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((email) => ({ email, recipientType: type }));
}

function readFieldValue(event: { target: EventTarget | null; currentTarget: EventTarget | null }) {
  const target = (event.target ?? event.currentTarget) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return target?.value ?? "";
}

export function ProjectForm({
  initialProject,
  lookups,
  users,
  mode,
  canManageAccess = true,
  onSaved,
}: {
  initialProject?: ProjectRecord | null;
  lookups: LookupMap;
  users: Array<{ id: string; name: string; email: string; role: string }>;
  mode: "create" | "edit";
  canManageAccess?: boolean;
  onSaved?: () => void;
}) {
  const [project, setProject] = useState<ProjectRecord>(initialProject ?? emptyProject);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [toRecipients, setToRecipients] = useState(
    recipientsToText(initialProject?.recipients, "to"),
  );
  const [ccRecipients, setCcRecipients] = useState(
    recipientsToText(initialProject?.recipients, "cc"),
  );

  const pmUsers = useMemo(
    () => users.filter((user) => user.role === "pm" || user.role === "admin"),
    [users],
  );

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      ...project,
      recipients: [
        ...parseRecipients(toRecipients, "to"),
        ...parseRecipients(ccRecipients, "cc"),
      ],
    };

    const response = await fetch(
      mode === "create" ? "/api/projects" : `/api/projects/${project.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setSaving(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setMessage(result.error ?? "Unable to save project.");
      return;
    }

    setMessage(mode === "create" ? "Project created." : "Project updated.");
    onSaved?.();
  }

  return (
    <form onSubmit={saveProject} className="app-card app-stack">
      <div className="app-card__header">
        <div>
          <h3 className="app-card__title">
            {mode === "create" ? "Create project" : "Project master tracker"}
          </h3>
          <p className="app-helper-text">
            This form mirrors the Excel master tracker and adds project dates plus email controls.
          </p>
        </div>
      </div>
      <div className="app-form-grid">
        <TextInput
          id="projectCode"
          readOnly={!canManageAccess}
          labelText="Project ID"
          value={project.projectCode}
          onChange={(event) =>
            setProject((current) => ({ ...current, projectCode: readFieldValue(event) }))
          }
        />
        <TextInput
          id="projectName"
          labelText="Project Name"
          value={project.projectName}
          onChange={(event) =>
            setProject((current) => ({ ...current, projectName: readFieldValue(event) }))
          }
        />
        <Select
          id="projectStage"
          labelText="Project Stage"
          value={project.projectStage}
          onChange={(event) =>
            setProject((current) => ({ ...current, projectStage: readFieldValue(event) }))
          }
        >
          <SelectItem text="Select stage" value="" />
          {(lookups.project_stage ?? []).map((value) => (
            <SelectItem key={value} text={value} value={value} />
          ))}
        </Select>
        <Select
          id="health"
          labelText="Health"
          value={project.health}
          onChange={(event) =>
            setProject((current) => ({ ...current, health: readFieldValue(event) }))
          }
        >
          <SelectItem text="Select health" value="" />
          {(lookups.health ?? []).map((value) => (
            <SelectItem key={value} text={value} value={value} />
          ))}
        </Select>
        <Select
          id="priority"
          labelText="Priority"
          value={project.priority}
          onChange={(event) =>
            setProject((current) => ({ ...current, priority: readFieldValue(event) }))
          }
        >
          <SelectItem text="Select priority" value="" />
          {(lookups.priority ?? []).map((value) => (
            <SelectItem key={value} text={value} value={value} />
          ))}
        </Select>
        <Select
          id="updateFrequency"
          labelText="Update Frequency"
          value={project.updateFrequency}
          onChange={(event) =>
            setProject((current) => ({
              ...current,
              updateFrequency: readFieldValue(event),
            }))
          }
        >
          <SelectItem text="Select frequency" value="" />
          {(lookups.update_frequency ?? []).map((value) => (
            <SelectItem key={value} text={value} value={value} />
          ))}
        </Select>
        <TextInput
          id="progressPercent"
          labelText="Progress %"
          type="number"
          min={0}
          max={100}
          helperText="Numeric progress from 0 to 100"
          value={project.progressPercent ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, progressPercent: readFieldValue(event) }))
          }
        />
        <TextInput
          id="pmName"
          readOnly={!canManageAccess}
          labelText="PM Name"
          value={project.pmName}
          onChange={(event) =>
            setProject((current) => ({ ...current, pmName: readFieldValue(event) }))
          }
        />
        <TextInput
          id="projectSponsor"
          labelText="Project Sponsor"
          value={project.projectSponsor ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, projectSponsor: readFieldValue(event) }))
          }
        />
        {canManageAccess && (
          <Select
            id="primaryPmUserId"
            labelText="Assigned PM User"
            value={project.primaryPmUserId ?? ""}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                primaryPmUserId: readFieldValue(event),
              }))
            }
          >
            <SelectItem text="Not assigned" value="" />
            {pmUsers.map((user) => (
              <SelectItem key={user.id} text={`${user.name} (${user.email})`} value={user.id} />
            ))}
          </Select>
        )}
        <TextInput
          id="startDate"
          labelText="Start Date"
          type="date"
          helperText={formatDisplayDate(project.startDate) ?? "Project planned start date"}
          value={project.startDate ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, startDate: readFieldValue(event) }))
          }
        />
        <TextInput
          id="endDate"
          labelText="Planned End Date"
          type="date"
          helperText={formatDisplayDate(project.endDate) ?? "Project planned end date"}
          value={project.endDate ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, endDate: readFieldValue(event) }))
          }
        />
        <TextInput
          id="actualEndDate"
          labelText="Actual End Date"
          type="date"
          helperText={formatDisplayDate(project.actualEndDate) ?? "Project actual completion date"}
          value={project.actualEndDate ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, actualEndDate: readFieldValue(event) }))
          }
        />
        <TextInput
          id="budgetCurrency"
          labelText="Currency"
          value={project.budgetCurrency ?? "AED"}
          onChange={(event) =>
            setProject((current) => ({ ...current, budgetCurrency: readFieldValue(event).toUpperCase() }))
          }
        />
        <TextInput
          id="contractValue"
          labelText="Contract Value"
          type="number"
          step="0.01"
          helperText="Total project or contract value"
          value={project.contractValue ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, contractValue: readFieldValue(event) }))
          }
        />
        <TextInput
          id="actualSpendToDate"
          labelText="Actual Spend To Date"
          type="number"
          step="0.01"
          helperText="Total amount spent so far"
          value={project.actualSpendToDate ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, actualSpendToDate: readFieldValue(event) }))
          }
        />
        <TextInput
          id="nextMilestone"
          labelText="Next Milestone Snapshot"
          value={project.nextMilestone ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, nextMilestone: readFieldValue(event) }))
          }
        />
        <TextInput
          id="nextMilestoneDate"
          labelText="Next Milestone Date"
          type="date"
          helperText={
            formatDisplayDate(project.nextMilestoneDate) ?? "Displayed in tracker summaries"
          }
          value={project.nextMilestoneDate ?? ""}
          onChange={(event) =>
            setProject((current) => ({
              ...current,
              nextMilestoneDate: readFieldValue(event),
            }))
          }
        />
        <TextInput
          id="lastUpdated"
          labelText="Last Updated"
          type="date"
          helperText={
            formatDisplayDate(project.lastUpdated) ?? "Used to calculate reporting freshness"
          }
          value={project.lastUpdated ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, lastUpdated: readFieldValue(event) }))
          }
        />
        <TextInput
          id="pendingWith"
          labelText="Current action owner"
          value={project.pendingWith ?? ""}
          onChange={(event) =>
            setProject((current) => ({ ...current, pendingWith: readFieldValue(event) }))
          }
        />
      </div>
      <TextArea
        id="projectDescription"
        labelText="About the Project"
        rows={3}
        value={project.projectDescription ?? ""}
        onChange={(event) =>
          setProject((current) => ({ ...current, projectDescription: readFieldValue(event) }))
        }
      />
      <TextArea
        id="currentPosition"
        labelText="Current Status"
        rows={4}
        value={project.currentPosition ?? ""}
        onChange={(event) =>
          setProject((current) => ({ ...current, currentPosition: readFieldValue(event) }))
        }
      />
      <TextArea
        id="keyNextAction"
        labelText={project.projectStage === "Completed" ? "Completed Deliverables" : "Current Action"}
        rows={3}
        value={project.keyNextAction ?? ""}
        onChange={(event) =>
          setProject((current) => ({ ...current, keyNextAction: readFieldValue(event) }))
        }
      />
      <TextArea
        id="mainBlockerRisk"
        labelText="Main Blocker / Risk"
        rows={3}
        value={project.mainBlockerRisk ?? ""}
        onChange={(event) =>
          setProject((current) => ({ ...current, mainBlockerRisk: readFieldValue(event) }))
        }
      />
      <TextArea
        id="managementUpdate"
        labelText="Management Update"
        helperText="Shown on the project card; maintained independently from blockers and risks."
        rows={4}
        value={project.managementUpdate ?? ""}
        onChange={(event) =>
          setProject((current) => ({ ...current, managementUpdate: readFieldValue(event) }))
        }
      />
      {canManageAccess && (
        <>
          <div className="app-form-grid">
            <TextArea
              id="toRecipients"
              labelText="To Recipients"
              helperText="One email per line or comma-separated"
              rows={4}
              value={toRecipients}
              onChange={(event) => setToRecipients(readFieldValue(event))}
            />
            <TextArea
              id="ccRecipients"
              labelText="CC Recipients"
              helperText="One email per line or comma-separated"
              rows={4}
              value={ccRecipients}
              onChange={(event) => setCcRecipients(readFieldValue(event))}
            />
          </div>
          <div className="app-inline-actions">
            <Checkbox
              id="weeklyEmailEnabled"
              labelText="Weekly emails enabled"
              checked={Boolean(project.weeklyEmailEnabled)}
              onChange={(_, { checked }) =>
                setProject((current) => ({ ...current, weeklyEmailEnabled: checked }))
              }
            />
            <Checkbox
              id="monthlyEmailEnabled"
              labelText="Monthly emails enabled"
              checked={Boolean(project.monthlyEmailEnabled)}
              onChange={(_, { checked }) =>
                setProject((current) => ({ ...current, monthlyEmailEnabled: checked }))
              }
            />
          </div>
        </>
      )}
      <div className="app-inline-actions">
        <Button type="submit" disabled={saving}>
          {mode === "create" ? "Create project" : "Save changes"}
        </Button>
        {saving ? <InlineLoading description="Saving..." /> : null}
        {message ? <p className="app-helper-text">{message}</p> : null}
      </div>
    </form>
  );
}
