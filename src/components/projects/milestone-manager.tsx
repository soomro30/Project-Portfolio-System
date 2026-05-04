"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { Button, InlineLoading, Select, SelectItem, TextArea, TextInput } from "@carbon/react";

import { formatDisplayDate } from "@/lib/utils/format";

type Milestone = {
  id?: string;
  title: string;
  dueDate?: string | null;
  status: string;
  owner?: string | null;
  notes?: string | null;
  sortOrder: number;
};

function readFieldValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return target?.value ?? "";
}

export function MilestoneManager({
  projectId,
  initialMilestones,
  onSaved,
}: {
  projectId: string;
  initialMilestones: Milestone[];
  onSaved?: () => void;
}) {
  const [milestones, setMilestones] = useState<Milestone[]>(
    initialMilestones.length
      ? initialMilestones
      : [{ title: "", dueDate: "", status: "planned", owner: "", notes: "", sortOrder: 0 }],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateMilestone(index: number, patch: Partial<Milestone>) {
    setMilestones((current) =>
      current.map((milestone, currentIndex) =>
        currentIndex === index ? { ...milestone, ...patch } : milestone,
      ),
    );
  }

  function addMilestone() {
    setMilestones((current) => [
      ...current,
      {
        title: "",
        dueDate: "",
        status: "planned",
        owner: "",
        notes: "",
        sortOrder: current.length,
      },
    ]);
  }

  function deleteMilestone(index: number) {
    setMilestones((current) =>
      current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((milestone, sortOrder) => ({ ...milestone, sortOrder })),
    );
  }

  async function saveMilestones() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestones }),
    });
    setSaving(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setMessage(result.error ?? "Unable to save milestones.");
      return;
    }

    setMessage("Milestones updated.");
    onSaved?.();
  }

  return (
    <section className="app-card app-stack">
      <div className="app-card__header">
        <div>
          <h3 className="app-card__title">Milestones</h3>
          <p className="app-helper-text">
            Manage the ordered milestone list that drives the next milestone snapshot.
          </p>
        </div>
        <Button kind="tertiary" size="sm" onClick={addMilestone}>
          Add milestone
        </Button>
      </div>
      {milestones.length === 0 ? (
        <div className="app-card" style={{ padding: "1rem" }}>
          <p className="app-helper-text">No milestones are currently recorded for this project.</p>
        </div>
      ) : null}
      {milestones.map((milestone, index) => (
        <div key={milestone.id ?? `new-${index}`} className="app-card" style={{ padding: "1rem" }}>
          <div className="app-card__header">
            <div>
              <h4 className="app-card__title">Milestone {index + 1}</h4>
              <p className="app-helper-text">
                {milestone.title || "Untitled milestone"}
              </p>
            </div>
            <Button kind="danger--tertiary" size="sm" onClick={() => deleteMilestone(index)}>
              Delete milestone
            </Button>
          </div>
          <div className="app-form-grid">
            <TextInput
              id={`milestone-title-${index}`}
              labelText="Title"
              value={milestone.title}
              onChange={(event) => updateMilestone(index, { title: readFieldValue(event) })}
            />
            <TextInput
              id={`milestone-dueDate-${index}`}
              labelText="Due Date"
              type="date"
              size="sm"
              helperText={formatDisplayDate(milestone.dueDate) ?? "Pick milestone due date"}
              value={milestone.dueDate ?? ""}
              onChange={(event) =>
                updateMilestone(index, { dueDate: readFieldValue(event) })
              }
            />
            <Select
              id={`milestone-status-${index}`}
              labelText="Status"
              value={milestone.status}
              onChange={(event) => updateMilestone(index, { status: readFieldValue(event) })}
            >
              {["planned", "in_progress", "at_risk", "completed"].map((value) => (
                <SelectItem key={value} text={value} value={value} />
              ))}
            </Select>
            <TextInput
              id={`milestone-owner-${index}`}
              labelText="Owner"
              value={milestone.owner ?? ""}
              onChange={(event) => updateMilestone(index, { owner: readFieldValue(event) })}
            />
            <TextInput
              id={`milestone-sortOrder-${index}`}
              labelText="Sort Order"
              type="number"
              value={String(milestone.sortOrder)}
              onChange={(event) =>
                updateMilestone(index, { sortOrder: Number(readFieldValue(event)) })
              }
            />
          </div>
          <TextArea
            id={`milestone-notes-${index}`}
            labelText="Notes"
            rows={3}
            value={milestone.notes ?? ""}
            onChange={(event) => updateMilestone(index, { notes: readFieldValue(event) })}
          />
        </div>
      ))}
      <div className="app-inline-actions">
        <Button size="sm" onClick={saveMilestones} disabled={saving}>
          Save milestones
        </Button>
        {saving ? <InlineLoading description="Saving milestones..." /> : null}
        {message ? <p className="app-helper-text">{message}</p> : null}
      </div>
    </section>
  );
}
