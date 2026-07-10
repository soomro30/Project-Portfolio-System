"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import Image from "next/image";
import { Button, Tag } from "@carbon/react";
import {
  ArrowLeft,
  Calendar,
  Checkmark,
  Maximize,
} from "@carbon/icons-react";

import { formatDisplayDate } from "@/lib/utils/format";

type PresentationProject = {
  id: string;
  projectCode: string;
  projectName: string;
  projectStage: string;
  pmName: string;
  projectSponsor?: string | null;
  health: string;
  currentPosition?: string | null;
  keyNextAction?: string | null;
  pendingWith?: string | null;
  mainBlockerRisk?: string | null;
  nextMilestone?: string | null;
  nextMilestoneDate?: string | null;
  lastUpdated?: string | null;
  progressPercent?: number | null;
  milestones: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    status: string;
    sortOrder: number;
    completedAt?: string | null;
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
    pendingWith?: string | null;
    nextMilestone?: string | null;
    nextMilestoneDate?: string | null;
    helpNeeded?: string | null;
  }>;
};

type DashboardMilestone = PresentationProject["milestones"][number];

const dayMs = 1000 * 60 * 60 * 24;

function parseDateOnly(value?: string | null) {
  if (!value) {
    return null;
  }

  const [datePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function diffDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / dayMs);
}

function getTodayDateOnly() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Dubai",
    year: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(year, month - 1, day);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function normalizeStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function statusTone(status: string) {
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

function healthTone(health: string) {
  if (health === "Red") {
    return "red";
  }

  if (health === "Amber") {
    return "warm-gray";
  }

  return "green";
}

function milestoneProgress(milestone: DashboardMilestone) {
  if (milestone.status === "completed") {
    return 100;
  }

  if (milestone.status === "in_progress" || milestone.status === "at_risk") {
    return 45;
  }

  return 0;
}

function getMilestoneDate(milestone: DashboardMilestone) {
  return parseDateOnly(milestone.dueDate) ?? parseDateOnly(milestone.completedAt);
}

function getMilestoneSchedule(milestone: DashboardMilestone, implementationStartDate?: Date | null) {
  const end = getMilestoneDate(milestone);

  if (!end) {
    return null;
  }

  const title = milestone.title.toLowerCase();

  if (title.includes("technical implementation") && implementationStartDate) {
    return { start: implementationStartDate, end };
  }

  if (/week\s*\d/.test(title)) {
    return { start: addDays(end, -6), end };
  }

  if (title.includes("go live")) {
    return { start: addDays(end, -7), end };
  }

  return { start: end, end };
}

function buildTimelineRange(milestones: DashboardMilestone[], startOverride?: Date | null) {
  const today = getTodayDateOnly();
  const dates = milestones
    .map(getMilestoneDate)
    .filter((date): date is Date => Boolean(date));

  if (!dates.length) {
    return { start: addDays(today, -14), end: addDays(today, 42) };
  }

  const first = new Date(Math.min(...dates.map((date) => date.getTime())));
  const last = new Date(Math.max(...dates.map((date) => date.getTime())));

  return {
    start: startOverride ?? first,
    end: addDays(last, 10),
  };
}

function buildWeeklyTicks(start: Date, end: Date) {
  const ticks = [];
  let current = new Date(start);

  while (current <= end) {
    ticks.push(new Date(current));
    current = addDays(current, 7);
  }

  return ticks;
}

function getPosition(date: Date, start: Date, end: Date) {
  const total = Math.max(1, diffDays(start, end));
  return Math.min(100, Math.max(0, (diffDays(start, date) / total) * 100));
}

function requestFullScreen() {
  document.documentElement.requestFullscreen?.();
}

const stakeholderRows = [
  ["Project Sponsor", "ADCG"],
  ["Project Owner", "Eng Suwaidan - CEO IMKAN"],
  ["Stakeholder (Finance)", "Aly Sabry - CFO IMKAN"],
  ["Stakeholder (Procurement)", "Nader Alawlaqi - CCO IMKAN"],
  ["Project Management & Coordination", "SAAL"],
];

const vendorLogos = [
  {
    alt: "Jaggaer",
    name: "Jaggaer",
    slug: "jaggaer",
    src: "https://www.softwareworld.co/assets/software/logo/jaggaer.jpg",
  },
  {
    alt: "Zelo",
    name: "Zelo",
    slug: "zelo",
    src: "https://cdn.prod.website-files.com/681c4cc0c2c1042d77f3d013/681c57fddfab3bdb850af7db_Zelo-Logo.svg",
  },
  {
    alt: "Oracle",
    name: "Oracle",
    slug: "oracle",
    src: "https://www.oracle.com/a/ocom/img/oracle-logo.svg",
  },
];

const deliveryModules = [
  {
    module: "IMKAN Supplier Portal (Invoices & PPC)",
    readyDate: "10th July 2026",
    status: "in_progress",
  },
  {
    module: "Integration between Zelo, Oracle and Jaggaer (All API's)",
    readyDate: "10th July 2026",
    status: "in_progress",
  },
  {
    module: "Jaggaer Vendor Portal (Registration & Opt In)",
    readyDate: "13th July 2026",
    status: "in_progress",
  },
  {
    module: "UAT",
    readyDate: "10th July 2026",
    status: "planned",
  },
  {
    module: "Training on Supplier Portal and Vendor Portal",
    readyDate: "13th - 17th July 2026",
    status: "planned",
  },
  {
    module: "Go Live",
    readyDate: "17th July 2026",
    status: "planned",
  },
];

const dashboardNotes = [
  {
    description:
      "The Jaggaer Supplier Portal went live in November 2025 and suppliers are being registered on it. The Jaggaer Portal with Zelo marketing content, IMKAN branding, vendor registration and opt-in will be ready for Zelo by next week.",
    id: "zelo-note-jaggaer-portal",
    title: "Jaggaer Supplier Portal and vendor opt-in",
  },
  {
    description:
      "The Jaggaer Sourcing & Contracting Module (RFQ) is planned to go live on 15th August 2026.",
    id: "zelo-note-rfq-module",
    title: "Jaggaer Sourcing & Contracting Module (RFQ)",
  },
];

const presentationCurrentStatus =
  "The project is now in Week 5. All previous week development activities have been completed. This week the team is testing integrations and the Supplier Portal. UAT will start toward the end of this week, and the Jaggaer portal will be ready for Zelo by next week.";

const presentationProgressPercent = 80;

export function ProjectPresentationDashboard({
  project,
}: {
  project: PresentationProject;
}) {
  const orderedMilestones = useMemo(
    () =>
      project.milestones
        .slice()
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          const leftDate = parseDateOnly(left.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const rightDate = parseDateOnly(right.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return leftDate - rightDate;
        }),
    [project.milestones],
  );
  const implementationStartDate = getMilestoneDate(
    orderedMilestones.find((milestone) => /implementation start/i.test(milestone.title)) ?? orderedMilestones[0],
  );
  const estimatedGoLiveDate = getMilestoneDate(
    orderedMilestones.find((milestone) => /go live/i.test(milestone.title)),
  );
  const presentationMilestones = orderedMilestones.map((milestone) => {
    if (/implementation week [1-4]/i.test(milestone.title)) {
      return { ...milestone, status: "completed" };
    }

    if (/implementation week 5/i.test(milestone.title) || /supplier portal testing/i.test(milestone.title)) {
      return { ...milestone, status: "in_progress" };
    }

    return milestone;
  });
  const preProjectMilestones = presentationMilestones.slice(0, 10);
  const ganttMilestones = [
    {
      id: "presentation-kickoff",
      title: "Project Implementation Kickoff",
      dueDate: "2026-06-01",
      status: "completed",
      sortOrder: -1,
      completedAt: "2026-06-01",
    },
    ...presentationMilestones.slice(-8),
  ];
  const range = buildTimelineRange(orderedMilestones, implementationStartDate);
  const weeklyTicks = buildWeeklyTicks(range.start, range.end);
  const today = getTodayDateOnly();
  const todayLabel = formatShortDate(today);
  const todayPosition = today >= range.start && today <= range.end
    ? getPosition(today, range.start, range.end)
    : null;
  const noteItems = dashboardNotes;
  const dashboardProgressPercent = Math.max(project.progressPercent ?? 0, presentationProgressPercent);

  return (
    <main className="app-presentation">
      <header className="app-presentation__header">
        <div>
          <p className="app-presentation__eyebrow">{project.projectCode} presentation dashboard</p>
          <h1>{project.projectName}</h1>
          <div className="app-presentation__meta">
            <Tag type={healthTone(project.health)}>{project.health}</Tag>
            <Tag type="blue">{project.projectStage}</Tag>
            <span>Last updated {formatDisplayDate(today)}</span>
          </div>
        </div>
        <div className="app-presentation__brand-center">
          <Image src="/imkan-logo.png" alt="IMKAN" width={140} height={60} priority />
        </div>
        <div className="app-presentation__header-right">
          <div className="app-presentation__actions">
            <Button
              kind="ghost"
              size="sm"
              renderIcon={ArrowLeft}
              onClick={() => {
                window.location.href = `/projects/${project.id}`;
              }}
            >
              Project workspace
            </Button>
            <Button kind="primary" size="sm" renderIcon={Maximize} onClick={requestFullScreen}>
              Full screen
            </Button>
          </div>
          <Image src="/saal-logo.svg" alt="SAAL" width={116} height={40} priority />
        </div>
      </header>

      <section className="app-presentation__summary" aria-label="Project summary">
        <div className="app-presentation__summary-focus">
          <span>Current focus</span>
          <strong>Week 5 testing</strong>
          <p>Integration and Supplier Portal testing this week, with UAT starting toward the end of the week.</p>
          <div className="app-presentation__summary-status">
            <section>
              <b>Project Description</b>
              <p>
                Integration of IMKAN with Zelo Finance to automate vendor financing, Oracle-driven drawdown,
                disbursement, settlement, reconciliation, and business notifications.
              </p>
            </section>
            <section>
              <b>Current Status</b>
              <p>{presentationCurrentStatus}</p>
            </section>
          </div>
        </div>
        <div className="app-presentation__summary-timeline">
          <span>Project Timeline</span>
          <dl>
            <div>
              <dt>Implementation Start</dt>
              <dd>1st June 2026</dd>
            </div>
            <div>
              <dt>Implementation End</dt>
              <dd>15th July 2026</dd>
            </div>
            <div>
              <dt>Estimated Go Live</dt>
              <dd>{formatDisplayDate(estimatedGoLiveDate?.toISOString()) ?? "21st July 2026"}</dd>
            </div>
          </dl>
        </div>
        <div className="app-presentation__summary-progress">
          <span>Progress</span>
          <div
            className="app-presentation-gauge"
            style={{
              "--app-gauge-value": `${dashboardProgressPercent}%`,
            } as CSSProperties}
            aria-label="Project progress"
          >
            <strong>{dashboardProgressPercent}%</strong>
          </div>
        </div>
        <div className="app-presentation__summary-stakeholders">
          <span>Stakeholders</span>
          <table>
            <tbody>
              {stakeholderRows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Vendors</th>
                <td>
                  <div className="app-presentation-vendors">
                    {vendorLogos.map((vendor) => (
                      <span
                        key={vendor.slug}
                        className={`app-presentation-vendors__logo app-presentation-vendors__logo--${vendor.slug}`}
                      >
                        <Image src={vendor.src} alt={vendor.alt} width={110} height={28} unoptimized />
                        <b>{vendor.name}</b>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="app-presentation-history" aria-label="Pre project kickoff history">
        <div className="app-presentation-history__header">
          <strong>Pre Project Kickoff Activities Timeline</strong>
        </div>
        <ol className="app-presentation-history__track">
          {preProjectMilestones.map((milestone, index) => (
            <li key={milestone.id}>
              <div className="app-presentation-history__node">
                <Checkmark size={18} />
                <small>{index + 1}</small>
              </div>
              <b>{milestone.title}</b>
              <span>{formatDisplayDate(milestone.dueDate) ?? formatDisplayDate(milestone.completedAt)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="app-presentation__layout">
        <article className="app-presentation-panel app-presentation-panel--timeline">
          <div className="app-presentation-panel__header">
            <div>
              <p>Milestone Gantt</p>
              <h2>Project Implementation</h2>
            </div>
            <span>{formatShortDate(range.start)} - {formatShortDate(range.end)}</span>
          </div>
          <div className="app-presentation-gantt">
            <div className="app-presentation-gantt__axis">
              <span />
              <div className="app-presentation-gantt__axis-track">
                {weeklyTicks.map((tick) => (
                  <b
                    key={tick.toISOString()}
                    style={{ left: `${getPosition(tick, range.start, range.end)}%` }}
                  >
                    {formatShortDate(tick)}
                  </b>
                ))}
                {todayPosition != null ? (
                  <i style={{ left: `${todayPosition}%` }}>
                    Today {todayLabel}
                  </i>
                ) : null}
              </div>
            </div>
            {ganttMilestones.map((milestone, index) => {
              const schedule = getMilestoneSchedule(milestone, implementationStartDate);
              const startPosition = schedule ? getPosition(schedule.start, range.start, range.end) : 0;
              const endPosition = schedule ? getPosition(schedule.end, range.start, range.end) : 0;
              const width = Math.max(6, endPosition - startPosition);
              const left = Math.max(0, Math.min(100 - width, startPosition));
              const progress = milestoneProgress(milestone);

              return (
                <div key={milestone.id} className="app-presentation-gantt__row">
                  <div className="app-presentation-gantt__label">
                    <b>{index + 1}</b>
                    <span>{milestone.title}</span>
                    <Tag type={statusTone(milestone.status)}>{normalizeStatusLabel(milestone.status)}</Tag>
                  </div>
                  <div className="app-presentation-gantt__track">
                    {schedule ? (
                      <>
                        <span
                          className={`app-presentation-gantt__bar app-presentation-gantt__bar--${milestone.status.replace(/_/g, "-")}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          {milestone.status === "completed" ? <Checkmark size={16} /> : null}
                          <em>{progress}%</em>
                          <i style={{ width: `${progress}%` }} />
                        </span>
                        <small style={{ left: `${endPosition}%` }}>
                          {formatDisplayDate(milestone.dueDate) ?? formatDisplayDate(milestone.completedAt)}
                        </small>
                      </>
                    ) : (
                      <span className="app-presentation-gantt__empty">No date</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="app-presentation__side">
          <article className="app-presentation-panel">
            <div className="app-presentation-panel__header">
              <div>
                <p>Delivery Plan</p>
                <h2>Key Deliverables Status</h2>
              </div>
              <Calendar size={24} />
            </div>
            <div className="app-presentation-modules" role="table" aria-label="Module readiness">
              <div className="app-presentation-modules__head" role="row">
                <span role="columnheader">Module</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Ready Date</span>
              </div>
              {deliveryModules.map((item) => (
                <div key={item.module} className="app-presentation-modules__row" role="row">
                  <strong role="cell">{item.module}</strong>
                  <Tag type={statusTone(item.status)}>{normalizeStatusLabel(item.status)}</Tag>
                  <span role="cell">{item.readyDate}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="app-presentation-panel app-presentation-panel--risks">
            <div className="app-presentation-panel__header">
              <div>
                <p>Notes</p>
                <h2>Key Notes</h2>
              </div>
            </div>
            <div className="app-presentation-risks">
              {noteItems.map((note, index) => (
                <section key={note.id}>
                  <div>
                    <Tag type="cool-gray" size="sm">{index + 1}</Tag>
                    <strong>{note.title}</strong>
                  </div>
                  <p>{note.description}</p>
                </section>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
