"use client";

import { useEffect, useState } from "react";
import { Button, DataTableSkeleton, InlineNotification, Stack, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from "@carbon/react";

import { AppBreadcrumbs } from "@/components/navigation/app-breadcrumbs";

type ReportsPayload = {
  projects: Array<{ id: string; projectCode: string; projectName: string; health: string }>;
  updates: Array<{ id: string; updateDate: string; stage: string; health: string; whatHappened: string }>;
  overdueMilestones: Array<{ id: string; title: string; dueDate: string; projectId: string }>;
  recentEmailRuns: Array<{ id: string; cadence: string; status: string; subject?: string | null; createdAt: string }>;
};

export function ReportsClient() {
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    void (async () => {
      try {
        const response = await fetch("/api/reports/summary?view=reports", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Reports could not be loaded.");
        }

        const result = (await response.json()) as { reports?: ReportsPayload };

        if (!result.reports) {
          throw new Error("Reports response was empty.");
        }

        if (active) {
          setData(result.reports);
        }
      } catch (fetchError) {
        if (active) {
          setError(timedOut ? "Reports took too long to load. Please try again." : fetchError instanceof Error ? fetchError.message : "Reports could not be loaded.");
        }
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (error) {
    return (
      <Stack gap={5}>
        <InlineNotification
          kind="error"
          title="Reports could not load"
          subtitle={error}
          lowContrast
        />
        <Button onClick={() => window.location.reload()}>Reload reports</Button>
      </Stack>
    );
  }

  if (!data) {
    return <DataTableSkeleton rowCount={8} columnCount={5} />;
  }

  return (
    <div className="app-page">
      <section className="app-page__hero">
        <AppBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Reports" },
          ]}
        />
        <p className="app-page__eyebrow">Operational reporting</p>
        <h1 className="app-page__title">Reports</h1>
        <p className="app-page__subtitle">
          Review overdue milestones, the latest project submissions, and the email delivery audit trail.
        </p>
      </section>
      <div className="app-grid app-grid--two">
        <section className="app-card app-stack">
          <h2 className="app-card__title">Recent weekly updates</h2>
          <div className="app-table-wrap">
            <Table size="sm" useZebraStyles>
              <TableHead>
                <TableRow>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Stage</TableHeader>
                  <TableHeader>Health</TableHeader>
                  <TableHeader>Summary</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.updates.map((update) => (
                  <TableRow key={update.id}>
                    <TableCell>{update.updateDate}</TableCell>
                    <TableCell>{update.stage}</TableCell>
                    <TableCell>{update.health}</TableCell>
                    <TableCell>{update.whatHappened}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
        <section className="app-card app-stack">
          <h2 className="app-card__title">Overdue milestones</h2>
          <div className="app-list">
            {data.overdueMilestones.map((milestone) => (
              <div key={milestone.id} className="app-list__item">
                <div>
                  <strong>{milestone.title}</strong>
                  <p className="app-helper-text">{milestone.projectId}</p>
                </div>
                <Tag type="red">{milestone.dueDate}</Tag>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="app-card app-stack">
        <h2 className="app-card__title">Email audit</h2>
        <div className="app-table-wrap">
          <Table size="sm" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>Cadence</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Subject</TableHeader>
                <TableHeader>Created</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.recentEmailRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{run.cadence}</TableCell>
                  <TableCell>{run.status}</TableCell>
                  <TableCell>{run.subject ?? "-"}</TableCell>
                  <TableCell>{run.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
