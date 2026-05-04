"use client";

import { useEffect, useState } from "react";
import type { CarbonIconType } from "@carbon/icons-react";
import {
  Calendar,
  ChartColumn,
  CheckmarkFilled,
  Flag,
  Portfolio,
  Time,
  WarningAltFilled,
} from "@carbon/icons-react";
import {
  AILabel,
  AILabelContent,
  ClickableTile,
  Column,
  Button,
  DataTableSkeleton,
  FeatureFlags,
  Grid,
  InlineNotification,
  ProgressBar,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Tile,
  Link as CarbonLink,
} from "@carbon/react";

type DashboardData = {
  totals: {
    totalProjects: number;
    inFlight: number;
    delayed: number;
    critical: number;
  };
  healthCounts: Record<string, number>;
  lateProjects: Array<{ id: string; projectCode: string; projectName: string; lateDays: number }>;
  upcomingMilestones: Array<{ id: string; title: string; dueDate?: string | null; project?: { id: string; projectCode: string; projectName: string } }>;
  recentEmailRuns: Array<{ id: string; cadence: string; status: string; subject?: string | null; createdAt: string; projectId?: string | null }>;
};

type CarbonTagType = "blue" | "cool-gray" | "green" | "magenta" | "purple" | "red" | "teal" | "warm-gray";

function formatDate(value?: string | null) {
  if (!value) {
    return "No date";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function getShare(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function PortfolioIntelligenceLabel() {
  return (
    <AILabel align="bottom-right" aria-label="Explain portfolio intelligence">
      <AILabelContent>
        <h3>Portfolio intelligence</h3>
        <p>
          This brief is generated from the portfolio tracker: delivery health, late reporting cadence, delayed stages,
          critical priority, and upcoming milestone dates.
        </p>
        <hr />
        <p>
          It does not change project records. Use it as a decision-support signal and verify details in the project
          master tracker before taking action.
        </p>
      </AILabelContent>
    </AILabel>
  );
}

function MetricTile({
  title,
  value,
  caption,
  tagType,
  icon: Icon,
  progress,
  href,
}: {
  title: string;
  value: number | string;
  caption: string;
  tagType: CarbonTagType;
  icon: CarbonIconType;
  progress: number;
  href: string;
}) {
  return (
    <ClickableTile href={href}>
      <Stack gap={5}>
        <Stack orientation="horizontal" gap={5}>
          <Icon size={24} aria-hidden="true" />
          <Tag type={tagType}>{title}</Tag>
        </Stack>
        <Stack gap={3}>
          <p>Portfolio metric</p>
          <h2>{value}</h2>
          <p>{caption}</p>
          <ProgressBar label={`${title} portfolio share`} hideLabel value={progress} max={100} size="small" />
        </Stack>
      </Stack>
    </ClickableTile>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p>{label}</p>;
}

function projectHref(projectId?: string | null) {
  return projectId ? `/projects/${projectId}` : "/projects";
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    void (async () => {
      try {
        setError(null);
        const response = await fetch("/api/reports/summary?view=dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Dashboard summary failed with ${response.status}`);
        }

        const result = (await response.json()) as { dashboard?: DashboardData };

        if (!result.dashboard) {
          throw new Error("Dashboard summary response was empty");
        }

        if (active) {
          setData(result.dashboard);
        }
      } catch (fetchError) {
        if (!active) {
          return;
        }

        if (timedOut) {
          setError("Dashboard data took too long to load. Please try again.");
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "Dashboard data could not be loaded.");
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
          title="Dashboard could not load"
          subtitle={error}
          lowContrast
        />
        <Button onClick={() => window.location.reload()}>Reload dashboard</Button>
      </Stack>
    );
  }

  if (!data) {
    return <DataTableSkeleton rowCount={5} columnCount={4} />;
  }

  const healthyProjects = data.healthCounts.Green ?? data.healthCounts.green ?? 0;
  const healthScore = getShare(healthyProjects, data.totals.totalProjects);
  const delayedShare = getShare(data.totals.delayed, data.totals.totalProjects);
  const inFlightShare = getShare(data.totals.inFlight, data.totals.totalProjects);
  const criticalShare = getShare(data.totals.critical, data.totals.totalProjects);
  const reportingPressure = data.lateProjects.length;
  const nearestMilestone = data.upcomingMilestones[0];
  const portfolioSignal = data.totals.delayed
    ? "Delivery exposure is low but visible; keep the delayed initiative in weekly steering."
    : "No delayed projects are currently recorded; keep focus on cadence and milestone readiness.";
  const leadershipSignal = data.totals.critical
    ? `${data.totals.critical} critical-priority projects need active sponsor visibility.`
    : "No critical-priority projects are currently recorded.";
  const cadenceSignal = reportingPressure
    ? `${reportingPressure} projects are outside the expected reporting rhythm.`
    : "All active projects are currently inside the expected reporting rhythm.";
  const milestoneSignal = nearestMilestone
    ? `${nearestMilestone.title} is the next dated milestone, due ${formatDate(nearestMilestone.dueDate)}.`
    : "No upcoming milestone dates are currently captured.";

  return (
    <FeatureFlags flags={{ "enable-css-grid": true }}>
      <Stack gap={7}>
        <section>
          <h1>Dashboard</h1>
        </section>

        <Grid fullWidth>
          <Column sm={4} md={4} lg={4}>
            <MetricTile
              title="Total portfolio"
              value={data.totals.totalProjects}
              caption="Active initiatives"
              tagType="blue"
              icon={Portfolio}
              progress={100}
              href="/projects"
            />
          </Column>
          <Column sm={4} md={4} lg={4}>
            <MetricTile
              title="In flight"
              value={data.totals.inFlight}
              caption="Moving through delivery"
              tagType="green"
              icon={ChartColumn}
              progress={inFlightShare}
              href="/projects?stageGroup=inFlight"
            />
          </Column>
          <Column sm={4} md={4} lg={4}>
            <MetricTile
              title="Delayed"
              value={data.totals.delayed}
              caption={`${delayedShare}% delivery exposure`}
              tagType="red"
              icon={Time}
              progress={delayedShare}
              href="/projects?projectStage=Delayed"
            />
          </Column>
          <Column sm={4} md={4} lg={4}>
            <MetricTile
              title="Critical priority"
              value={data.totals.critical}
              caption="Needs leadership focus"
              tagType="magenta"
              icon={WarningAltFilled}
              progress={criticalShare}
              href="/projects?priority=P1%20-%20Critical"
            />
          </Column>
        </Grid>

        <Grid fullWidth>
          <Column sm={4} md={8} lg={10}>
            <Tile decorator={<PortfolioIntelligenceLabel />} hasRoundedCorners>
              <Stack gap={6}>
                <Stack gap={2}>
                  <Tag type="blue">Portfolio intelligence</Tag>
                  <h2>Executive brief</h2>
                  <p>{portfolioSignal}</p>
                </Stack>
                <StructuredListWrapper aria-label="Portfolio intelligence brief" isCondensed>
                  <StructuredListBody>
                    <StructuredListRow>
                      <StructuredListCell>
                        <CarbonLink href="/projects?priority=P1%20-%20Critical">Leadership focus</CarbonLink>
                      </StructuredListCell>
                      <StructuredListCell>{leadershipSignal}</StructuredListCell>
                    </StructuredListRow>
                    <StructuredListRow>
                      <StructuredListCell>
                        <CarbonLink href="/projects?lateOnly=true">Operating rhythm</CarbonLink>
                      </StructuredListCell>
                      <StructuredListCell>{cadenceSignal}</StructuredListCell>
                    </StructuredListRow>
                    <StructuredListRow>
                      <StructuredListCell>
                        <CarbonLink href={projectHref(nearestMilestone?.project?.id)}>Milestone runway</CarbonLink>
                      </StructuredListCell>
                      <StructuredListCell>{milestoneSignal}</StructuredListCell>
                    </StructuredListRow>
                  </StructuredListBody>
                </StructuredListWrapper>
              </Stack>
            </Tile>
          </Column>
          <Column sm={4} md={8} lg={6}>
            <Tile>
              <Stack gap={5}>
                <Stack gap={2}>
                  <Tag type="cool-gray">Decision queue</Tag>
                  <h2>Today&apos;s steering priorities</h2>
                </Stack>
                <StructuredListWrapper aria-label="Steering priorities" isCondensed>
                  <StructuredListBody>
                    <StructuredListRow>
                      <StructuredListCell>
                        <CarbonLink href="/projects?priority=P1%20-%20Critical">Critical portfolio</CarbonLink>
                      </StructuredListCell>
                      <StructuredListCell>
                        <Tag type={data.totals.critical ? "magenta" : "green"}>{data.totals.critical}</Tag>
                      </StructuredListCell>
                    </StructuredListRow>
                    <StructuredListRow>
                      <StructuredListCell>
                        <CarbonLink href="/projects?lateOnly=true">Late updates</CarbonLink>
                      </StructuredListCell>
                      <StructuredListCell>
                        <Tag type={reportingPressure ? "red" : "green"}>{reportingPressure}</Tag>
                      </StructuredListCell>
                    </StructuredListRow>
                    <StructuredListRow>
                      <StructuredListCell>
                        <CarbonLink href={projectHref(nearestMilestone?.project?.id)}>Upcoming milestones</CarbonLink>
                      </StructuredListCell>
                      <StructuredListCell>
                        <Tag type="blue">{data.upcomingMilestones.length}</Tag>
                      </StructuredListCell>
                    </StructuredListRow>
                  </StructuredListBody>
                </StructuredListWrapper>
              </Stack>
            </Tile>
          </Column>
        </Grid>

        <Grid fullWidth>
          <Column sm={4} md={8} lg={4}>
            <ClickableTile href="/projects">
              <Stack gap={3}>
                <Tag type="cool-gray">Portfolio pulse</Tag>
                <h2>Delivery control tower</h2>
                <p>
                  Track movement, exposure, milestone readiness, and leadership demand across the portfolio.
                </p>
              </Stack>
            </ClickableTile>
          </Column>
          <Column sm={4} md={8} lg={4}>
            <ClickableTile href="/projects?health=Green">
              <Stack gap={4}>
                <CheckmarkFilled size={24} aria-hidden="true" />
                <p>Healthy delivery</p>
                <h3>{healthScore}%</h3>
                <ProgressBar label="Healthy delivery" hideLabel value={healthScore} max={100} size="small" />
              </Stack>
            </ClickableTile>
          </Column>
          <Column sm={4} md={4} lg={4}>
            <ClickableTile href="/projects?priority=P1%20-%20Critical">
              <Stack gap={4}>
                <Flag size={24} aria-hidden="true" />
                <p>Leadership attention</p>
                <h3>{data.totals.critical}</h3>
                <ProgressBar label="Leadership attention" hideLabel value={criticalShare} max={100} size="small" />
              </Stack>
            </ClickableTile>
          </Column>
          <Column sm={4} md={4} lg={4}>
            <ClickableTile href={projectHref(nearestMilestone?.project?.id)}>
              <Stack gap={4}>
                <Calendar size={24} aria-hidden="true" />
                <p>Milestone runway</p>
                <h3>{data.upcomingMilestones.length}</h3>
                <ProgressBar label="Milestone runway" hideLabel value={data.upcomingMilestones.length} max={Math.max(data.upcomingMilestones.length, 6)} size="small" />
              </Stack>
            </ClickableTile>
          </Column>
        </Grid>

        <Grid fullWidth>
          <Column sm={4} md={8} lg={16}>
            <Tile>
              <Stack gap={5}>
                <Stack gap={2}>
                  <Stack orientation="horizontal" gap={4}>
                    <Flag size={20} aria-hidden="true" />
                    <Tag type="cool-gray">Executive action board</Tag>
                  </Stack>
                  <h2>Portfolio focus areas</h2>
                  <p>Review leadership attention, delivery dates, and communication rhythm from one Carbon work surface.</p>
                </Stack>
                <Tabs>
                  <TabList aria-label="Portfolio focus areas" contained fullWidth>
                    <Tab>Late updates</Tab>
                    <Tab>Milestones</Tab>
                    <Tab>Email activity</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      {data.lateProjects.length ? (
                        <StructuredListWrapper aria-label="Late updates" isCondensed>
                          <StructuredListHead>
                            <StructuredListRow head>
                              <StructuredListCell head>Project</StructuredListCell>
                              <StructuredListCell head>Status</StructuredListCell>
                            </StructuredListRow>
                          </StructuredListHead>
                          <StructuredListBody>
                            {data.lateProjects.map((project) => (
                              <StructuredListRow key={project.id}>
                                <StructuredListCell>
                                  <CarbonLink href={`/projects/${project.id}`}>{project.projectName}</CarbonLink>
                                </StructuredListCell>
                                <StructuredListCell>
                                  <Tag type="red">{project.lateDays} late days</Tag>
                                </StructuredListCell>
                              </StructuredListRow>
                            ))}
                          </StructuredListBody>
                        </StructuredListWrapper>
                      ) : (
                        <EmptyState label="All active projects are inside the reporting cadence." />
                      )}
                    </TabPanel>
                    <TabPanel>
                      {data.upcomingMilestones.length ? (
                        <StructuredListWrapper aria-label="Upcoming milestones" isCondensed>
                          <StructuredListHead>
                            <StructuredListRow head>
                              <StructuredListCell head>Milestone</StructuredListCell>
                              <StructuredListCell head>Due</StructuredListCell>
                            </StructuredListRow>
                          </StructuredListHead>
                          <StructuredListBody>
                            {data.upcomingMilestones.map((milestone) => (
                              <StructuredListRow key={milestone.id}>
                                <StructuredListCell>
                                  <Stack gap={2}>
                                    <strong>{milestone.title}</strong>
                                    <CarbonLink href={projectHref(milestone.project?.id)}>
                                      {milestone.project?.projectName ?? "Unassigned project"}
                                    </CarbonLink>
                                  </Stack>
                                </StructuredListCell>
                                <StructuredListCell>
                                  <Tag type="blue">{formatDate(milestone.dueDate)}</Tag>
                                </StructuredListCell>
                              </StructuredListRow>
                            ))}
                          </StructuredListBody>
                        </StructuredListWrapper>
                      ) : (
                        <EmptyState label="No upcoming milestone dates are currently captured." />
                      )}
                    </TabPanel>
                    <TabPanel>
                      {data.recentEmailRuns.length ? (
                        <StructuredListWrapper aria-label="Recent email activity" isCondensed>
                          <StructuredListHead>
                            <StructuredListRow head>
                              <StructuredListCell head>Communication</StructuredListCell>
                              <StructuredListCell head>Status</StructuredListCell>
                            </StructuredListRow>
                          </StructuredListHead>
                          <StructuredListBody>
                            {data.recentEmailRuns.map((run) => (
                              <StructuredListRow key={run.id}>
                                <StructuredListCell>
                                  <Stack gap={2}>
                                    <strong>{run.subject ?? `${run.cadence} portfolio communication`}</strong>
                                    <span>{formatDate(run.createdAt)}</span>
                                    <CarbonLink href={projectHref(run.projectId)}>Open record</CarbonLink>
                                  </Stack>
                                </StructuredListCell>
                                <StructuredListCell>
                                  <Tag type={run.status === "sent" ? "green" : run.status === "failed" ? "red" : "blue"}>
                                    {run.status}
                                  </Tag>
                                </StructuredListCell>
                              </StructuredListRow>
                            ))}
                          </StructuredListBody>
                        </StructuredListWrapper>
                      ) : (
                        <EmptyState label="No recent email activity has been recorded." />
                      )}
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </Stack>
            </Tile>
          </Column>
        </Grid>
      </Stack>
    </FeatureFlags>
  );
}
