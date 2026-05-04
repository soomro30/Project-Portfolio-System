"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { Button, InlineLoading, Select, SelectItem, TextArea, TextInput } from "@carbon/react";

import { formatDisplayDate } from "@/lib/utils/format";

type ProjectRisk = {
  id?: string;
  title: string;
  description: string;
  owner?: string | null;
  mitigationPlan?: string | null;
  status: string;
  severity: string;
  targetDate?: string | null;
  sortOrder: number;
};

function readFieldValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return target?.value ?? "";
}

export function ProjectRiskManager({
  projectId,
  initialRisks,
  onSaved,
}: {
  projectId: string;
  initialRisks: ProjectRisk[];
  onSaved?: () => void;
}) {
  const [risks, setRisks] = useState<ProjectRisk[]>(
    initialRisks.length
      ? initialRisks
      : [
          {
            title: "",
            description: "",
            owner: "",
            mitigationPlan: "",
            status: "open",
            severity: "medium",
            targetDate: "",
            sortOrder: 0,
          },
        ],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateRisk(index: number, patch: Partial<ProjectRisk>) {
    setRisks((current) =>
      current.map((risk, currentIndex) => (currentIndex === index ? { ...risk, ...patch } : risk)),
    );
  }

  function addRisk() {
    setRisks((current) => [
      ...current,
      {
        title: "",
        description: "",
        owner: "",
        mitigationPlan: "",
        status: "open",
        severity: "medium",
        targetDate: "",
        sortOrder: current.length,
      },
    ]);
  }

  function deleteRisk(index: number) {
    setRisks((current) =>
      current.filter((_, currentIndex) => currentIndex !== index).map((risk, sortOrder) => ({ ...risk, sortOrder })),
    );
  }

  async function saveRisks() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/projects/${projectId}/risks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ risks }),
    });
    setSaving(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setMessage(result.error ?? "Unable to save risks.");
      return;
    }

    setMessage("Risks updated.");
    onSaved?.();
  }

  return (
    <section className="app-card app-stack">
      <div className="app-card__header">
        <div>
          <h3 className="app-card__title">Risks & issues</h3>
          <p className="app-helper-text">
            Maintain the project risk register with owners, mitigation plans, severity, and status.
          </p>
        </div>
        <Button kind="tertiary" size="sm" onClick={addRisk}>
          Add risk
        </Button>
      </div>
      {risks.length === 0 ? (
        <div className="app-card" style={{ padding: "1rem" }}>
          <p className="app-helper-text">No risks are currently recorded for this project.</p>
        </div>
      ) : null}
      {risks.map((risk, index) => (
        <div key={risk.id ?? `new-risk-${index}`} className="app-card" style={{ padding: "1rem" }}>
          <div className="app-card__header">
            <div>
              <h4 className="app-card__title">Risk {index + 1}</h4>
              <p className="app-helper-text">{risk.title || "Untitled risk"}</p>
            </div>
            <Button kind="danger--tertiary" size="sm" onClick={() => deleteRisk(index)}>
              Delete risk
            </Button>
          </div>
          <div className="app-form-grid">
            <TextInput
              id={`risk-title-${index}`}
              labelText="Risk / Issue Title"
              value={risk.title}
              onChange={(event) => updateRisk(index, { title: readFieldValue(event) })}
            />
            <TextInput
              id={`risk-owner-${index}`}
              labelText="Owner"
              value={risk.owner ?? ""}
              onChange={(event) => updateRisk(index, { owner: readFieldValue(event) })}
            />
            <Select
              id={`risk-status-${index}`}
              labelText="Status"
              value={risk.status}
              onChange={(event) => updateRisk(index, { status: readFieldValue(event) })}
            >
              {["open", "monitoring", "mitigated", "closed"].map((value) => (
                <SelectItem key={value} text={value} value={value} />
              ))}
            </Select>
            <Select
              id={`risk-severity-${index}`}
              labelText="Severity"
              value={risk.severity}
              onChange={(event) => updateRisk(index, { severity: readFieldValue(event) })}
            >
              {["low", "medium", "high", "critical"].map((value) => (
                <SelectItem key={value} text={value} value={value} />
              ))}
            </Select>
            <TextInput
              id={`risk-targetDate-${index}`}
              labelText="Target Date"
              type="date"
              helperText={formatDisplayDate(risk.targetDate) ?? "Optional closure or review date"}
              value={risk.targetDate ?? ""}
              onChange={(event) => updateRisk(index, { targetDate: readFieldValue(event) })}
            />
            <TextInput
              id={`risk-sortOrder-${index}`}
              labelText="Sort Order"
              type="number"
              value={String(risk.sortOrder)}
              onChange={(event) => updateRisk(index, { sortOrder: Number(readFieldValue(event)) })}
            />
          </div>
          <TextArea
            id={`risk-description-${index}`}
            labelText="Description"
            rows={3}
            value={risk.description}
            onChange={(event) => updateRisk(index, { description: readFieldValue(event) })}
          />
          <TextArea
            id={`risk-mitigation-${index}`}
            labelText="Mitigation / Action Plan"
            rows={3}
            value={risk.mitigationPlan ?? ""}
            onChange={(event) => updateRisk(index, { mitigationPlan: readFieldValue(event) })}
          />
        </div>
      ))}
      <div className="app-inline-actions">
        <Button size="sm" onClick={saveRisks} disabled={saving}>
          Save risks
        </Button>
        {saving ? <InlineLoading description="Saving risks..." /> : null}
        {message ? <p className="app-helper-text">{message}</p> : null}
      </div>
    </section>
  );
}
