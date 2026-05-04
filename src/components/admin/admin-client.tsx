"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  InlineLoading,
  MultiSelect,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";

import { AppBreadcrumbs } from "@/components/navigation/app-breadcrumbs";

type ProjectRecord = {
  id: string;
  projectCode: string;
  projectName: string;
  projectStage: string;
  pmName: string;
  health: string;
  priority: string;
};
type UserRecord = { id: string; name: string; email: string; role: string; active: boolean };
type BatchReportFile = {
  projectCode: string;
  projectName: string;
  fileName: string;
  downloadUrl: string;
  editableFileName: string;
  editableDownloadUrl: string;
};
type BatchReportResult = {
  runId: string;
  outputDir: string;
  cadence: "weekly" | "monthly";
  projectCount: number;
  sections: Array<{
    key: string;
    title: string;
    projectCount: number;
    stages: string[];
  }>;
  combinedFileName: string;
  combinedDownloadUrl: string;
  files: BatchReportFile[];
};
type FilterOption = { id: string; label: string };

function readFieldValue(event: { target: EventTarget | null; currentTarget: EventTarget | null }) {
  const target = (event.target ?? event.currentTarget) as HTMLSelectElement | null;
  return target?.value ?? "";
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim() || "Not assigned"))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function toFilterOptions(values: string[]) {
  return values.map((value) => ({ id: value, label: value }));
}

function optionLabel(option: FilterOption | null) {
  return option?.label ?? "";
}

function selectedOptionIds(items: Array<FilterOption | null> | null | undefined) {
  return (items ?? []).flatMap((item) => (item ? [item.id] : []));
}

export function AdminClient() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [cadence, setCadence] = useState<"weekly" | "monthly">("weekly");
  const [batchCadence, setBatchCadence] = useState<"weekly" | "monthly">("weekly");
  const [batchStages, setBatchStages] = useState<string[]>([]);
  const [batchPms, setBatchPms] = useState<string[]>([]);
  const [batchHealth, setBatchHealth] = useState<string[]>([]);
  const [batchPriorities, setBatchPriorities] = useState<string[]>([]);
  const [batchProjectIds, setBatchProjectIds] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<BatchReportResult | null>(null);
  const [loadingImport, setLoadingImport] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [message, setMessage] = useState("");

  const stageOptions = useMemo(
    () => uniqueSorted(projects.map((project) => project.projectStage)),
    [projects],
  );
  const pmOptions = useMemo(
    () => uniqueSorted(projects.map((project) => project.pmName || "Not assigned")),
    [projects],
  );
  const healthOptions = useMemo(
    () => uniqueSorted(projects.map((project) => project.health)),
    [projects],
  );
  const priorityOptions = useMemo(
    () => uniqueSorted(projects.map((project) => project.priority)),
    [projects],
  );
  const stageFilterOptions = useMemo(() => toFilterOptions(stageOptions), [stageOptions]);
  const pmFilterOptions = useMemo(() => toFilterOptions(pmOptions), [pmOptions]);
  const healthFilterOptions = useMemo(() => toFilterOptions(healthOptions), [healthOptions]);
  const priorityFilterOptions = useMemo(() => toFilterOptions(priorityOptions), [priorityOptions]);
  const filteredBatchProjects = useMemo(
    () =>
      projects.filter((project) => {
        if (batchStages.length && !batchStages.includes(project.projectStage)) {
          return false;
        }

        if (batchPms.length && !batchPms.includes(project.pmName || "Not assigned")) {
          return false;
        }

        if (batchHealth.length && !batchHealth.includes(project.health)) {
          return false;
        }

        if (batchPriorities.length && !batchPriorities.includes(project.priority)) {
          return false;
        }

        return true;
      }),
    [batchHealth, batchPms, batchPriorities, batchStages, projects],
  );
  const selectedBatchCount = batchProjectIds.length;

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/projects");
      const result = (await response.json()) as {
        projects: ProjectRecord[];
        users: UserRecord[];
      };
      setProjects(result.projects ?? []);
      setUsers(result.users ?? []);
      setSelectedProject(result.projects?.[0]?.id ?? "");
    })();
  }, []);

  async function runImport() {
    setLoadingImport(true);
    setMessage("");
    const response = await fetch("/api/admin/import", { method: "POST" });
    const result = (await response.json()) as { summary?: { projects: number; weeklyUpdates: number; lookupValues: number }; error?: string };
    setLoadingImport(false);
    setMessage(
      response.ok && result.summary
        ? `Imported ${result.summary.projects} projects, ${result.summary.weeklyUpdates} weekly updates, and ${result.summary.lookupValues} lookup values.`
        : result.error ?? "Import failed.",
    );
  }

  async function sendEmail() {
    setLoadingSend(true);
    setMessage("");
    const response = await fetch("/api/admin/email-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProject, cadence }),
    });
    const result = (await response.json()) as {
      result?: { status: string; errorMessage?: string | null };
      error?: string;
    };
    setLoadingSend(false);
    setMessage(
      response.ok
        ? result.result?.status === "failed" && result.result.errorMessage
          ? `Email run failed: ${result.result.errorMessage}`
          : `Email run finished with status ${result.result?.status}.`
        : result.error ?? "Email send failed.",
    );
  }

  function toggleBatchProject(projectId: string, checked: boolean) {
    setBatchProjectIds((current) =>
      checked
        ? Array.from(new Set([...current, projectId]))
        : current.filter((id) => id !== projectId),
    );
    setBatchResult(null);
  }

  function selectFilteredBatchProjects() {
    setBatchProjectIds(filteredBatchProjects.map((project) => project.id));
    setBatchResult(null);
  }

  function clearBatchSelection() {
    setBatchProjectIds([]);
    setBatchResult(null);
  }

  async function generateBatchReports() {
    setLoadingBatch(true);
    setMessage("");
    setBatchResult(null);

    const response = await fetch("/api/admin/batch-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cadence: batchCadence,
        projectIds: batchProjectIds,
        stages: batchStages,
        projectManagers: batchPms,
        health: batchHealth,
        priorities: batchPriorities,
      }),
    });
    const result = (await response.json()) as { result?: BatchReportResult; error?: string };
    setLoadingBatch(false);

    if (response.ok && result.result) {
      setBatchResult(result.result);
      setMessage(`Generated ${result.result.projectCount} ${batchCadence} PDF reports and one combined PDF.`);
      return;
    }

    setMessage(result.error ?? "Batch report generation failed.");
  }

  return (
    <div className="app-page">
      <section className="app-page__hero">
        <AppBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Admin" },
          ]}
        />
        <p className="app-page__eyebrow">Admin controls</p>
        <h1 className="app-page__title">Admin</h1>
        <p className="app-page__subtitle">
          Import the workbook, validate seeded users, and trigger project email sends while the worker is being configured.
        </p>
      </section>
      <div className="app-grid app-grid--two">
        <section className="app-card app-stack">
          <h2 className="app-card__title">Workbook import</h2>
          <p className="app-helper-text">
            Loads the current Excel workbook into PostgreSQL and seeds roles, PM users, project records, and weekly history.
          </p>
          <div className="app-inline-actions">
            <Button onClick={runImport} disabled={loadingImport}>
              Run workbook import
            </Button>
            {loadingImport ? <InlineLoading description="Importing workbook..." /> : null}
          </div>
        </section>
        <section className="app-card app-stack">
          <h2 className="app-card__title">Manual email test</h2>
          <Select
            id="project"
            labelText="Project"
            value={selectedProject}
            onChange={(event) => setSelectedProject(event.currentTarget.value)}
          >
            {projects.map((project) => (
              <SelectItem
                key={project.id}
                text={`${project.projectCode} - ${project.projectName}`}
                value={project.id}
              />
            ))}
          </Select>
          <Select
            id="cadence"
            labelText="Cadence"
            value={cadence}
            onChange={(event) => setCadence(event.currentTarget.value as "weekly" | "monthly")}
          >
            <SelectItem text="Weekly" value="weekly" />
            <SelectItem text="Monthly" value="monthly" />
          </Select>
          <div className="app-inline-actions">
            <Button onClick={sendEmail} disabled={loadingSend || !selectedProject}>
              Send test email
            </Button>
            {loadingSend ? <InlineLoading description="Sending..." /> : null}
          </div>
        </section>
      </div>
      {message ? <p className="app-helper-text">{message}</p> : null}
      <section className="app-card app-stack">
        <div className="app-card__header">
          <div>
            <h2 className="app-card__title">Batch PDF report generator</h2>
            <p className="app-helper-text">
              Filter the portfolio, select projects, and generate individual PDF reports plus one combined PDF in a server folder.
            </p>
          </div>
          <div className="app-inline-actions">
            {loadingBatch ? <InlineLoading description="Generating PDFs..." /> : null}
          </div>
        </div>
        <div className="app-form-grid">
          <Select
            id="batchCadence"
            labelText="Report type"
            value={batchCadence}
            onChange={(event) => setBatchCadence(readFieldValue(event) as "weekly" | "monthly")}
          >
            <SelectItem text="Weekly status reports" value="weekly" />
            <SelectItem text="Monthly status reports" value="monthly" />
          </Select>
          <MultiSelect
            id="batchStages"
            titleText="Project stages"
            label="All stages"
            items={stageFilterOptions}
            selectedItems={stageFilterOptions.filter((option) => batchStages.includes(option.id))}
            itemToString={optionLabel}
            onChange={({ selectedItems }) => {
              setBatchStages(selectedOptionIds(selectedItems));
              clearBatchSelection();
            }}
            selectionFeedback="fixed"
          />
          <MultiSelect
            id="batchPms"
            titleText="Project managers"
            label="All project managers"
            items={pmFilterOptions}
            selectedItems={pmFilterOptions.filter((option) => batchPms.includes(option.id))}
            itemToString={optionLabel}
            onChange={({ selectedItems }) => {
              setBatchPms(selectedOptionIds(selectedItems));
              clearBatchSelection();
            }}
            selectionFeedback="fixed"
          />
          <MultiSelect
            id="batchHealth"
            titleText="Health"
            label="All health"
            items={healthFilterOptions}
            selectedItems={healthFilterOptions.filter((option) => batchHealth.includes(option.id))}
            itemToString={optionLabel}
            onChange={({ selectedItems }) => {
              setBatchHealth(selectedOptionIds(selectedItems));
              clearBatchSelection();
            }}
            selectionFeedback="fixed"
          />
          <MultiSelect
            id="batchPriorities"
            titleText="Priorities"
            label="All priorities"
            items={priorityFilterOptions}
            selectedItems={priorityFilterOptions.filter((option) => batchPriorities.includes(option.id))}
            itemToString={optionLabel}
            onChange={({ selectedItems }) => {
              setBatchPriorities(selectedOptionIds(selectedItems));
              clearBatchSelection();
            }}
            selectionFeedback="fixed"
          />
        </div>
        <div className="app-inline-actions">
          <Button kind="secondary" onClick={selectFilteredBatchProjects} disabled={!filteredBatchProjects.length}>
            Select {filteredBatchProjects.length} matching projects
          </Button>
          <Button kind="ghost" onClick={clearBatchSelection} disabled={!selectedBatchCount}>
            Clear selection
          </Button>
          <Button onClick={generateBatchReports} disabled={loadingBatch || !selectedBatchCount}>
            Generate batch reports
          </Button>
          <span className="app-helper-text">
            {selectedBatchCount} selected of {filteredBatchProjects.length} matching projects
          </span>
        </div>
        <div className="app-table-wrap" style={{ maxHeight: "24rem", overflow: "auto" }}>
          <Table size="sm" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>Select</TableHeader>
                <TableHeader>Project</TableHeader>
                <TableHeader>Stage</TableHeader>
                <TableHeader>PM</TableHeader>
                <TableHeader>Health</TableHeader>
                <TableHeader>Priority</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBatchProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Checkbox
                      id={`batch-${project.id}`}
                      labelText=""
                      hideLabel
                      checked={batchProjectIds.includes(project.id)}
                      onChange={(_, { checked }) => toggleBatchProject(project.id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    {project.projectCode} - {project.projectName}
                  </TableCell>
                  <TableCell>{project.projectStage}</TableCell>
                  <TableCell>{project.pmName || "Not assigned"}</TableCell>
                  <TableCell>{project.health}</TableCell>
                  <TableCell>{project.priority}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {batchResult ? (
          <div className="app-card" style={{ padding: "1rem" }}>
            <h3 className="app-card__title">Batch output ready</h3>
            <p className="app-helper-text">
              Folder: <code>{batchResult.outputDir}</code>
            </p>
            <div className="app-inline-actions">
              <Button href={batchResult.combinedDownloadUrl}>
                Download combined PDF
              </Button>
              <span className="app-helper-text">
                {batchResult.projectCount} reports generated in {batchResult.sections.length} stage groups for run{" "}
                {batchResult.runId}
              </span>
            </div>
            <div className="app-table-wrap">
              <Table size="sm" useZebraStyles>
                <TableHead>
                  <TableRow>
                    <TableHeader>Combined PDF section</TableHeader>
                    <TableHeader>Projects</TableHeader>
                    <TableHeader>Included stages</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchResult.sections.map((section) => (
                    <TableRow key={section.key}>
                      <TableCell>{section.title}</TableCell>
                      <TableCell>{section.projectCount}</TableCell>
                      <TableCell>{section.stages.join(", ") || "Not specified"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="app-table-wrap">
              <Table size="sm" useZebraStyles>
                <TableHead>
	                  <TableRow>
	                    <TableHeader>Project</TableHeader>
	                    <TableHeader>PDF</TableHeader>
	                    <TableHeader>Editable source</TableHeader>
	                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchResult.files.map((file) => (
                    <TableRow key={file.fileName}>
                      <TableCell>
                        {file.projectCode} - {file.projectName}
                      </TableCell>
	                      <TableCell>
	                        <Button kind="ghost" size="sm" href={file.downloadUrl}>
	                          Download
	                        </Button>
	                      </TableCell>
	                      <TableCell>
	                        <Button kind="ghost" size="sm" href={file.editableDownloadUrl}>
	                          Download HTML
	                        </Button>
	                      </TableCell>
	                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </section>
      <section className="app-card app-stack">
        <h2 className="app-card__title">Seeded users</h2>
        <div className="app-table-wrap">
          <Table size="sm" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.active ? "Active" : "Inactive"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
