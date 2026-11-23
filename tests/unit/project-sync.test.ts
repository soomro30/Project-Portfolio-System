import { describe, expect, it } from "vitest";

import {
  applyWeeklyUpdateToProject,
  deriveNextMilestone,
  getLateDays,
} from "../../src/lib/domain/project-sync";

describe("project sync helpers", () => {
  it("chooses the nearest open milestone by date and order", () => {
    const result = deriveNextMilestone([
      { title: "Contract", dueDate: "2026-05-20", status: "planned", sortOrder: 2 },
      { title: "Kickoff", dueDate: "2026-05-01", status: "planned", sortOrder: 1 },
      { title: "Done", dueDate: "2026-04-01", status: "completed", sortOrder: 0 },
    ]);

    expect(result).toEqual({
      nextMilestone: "Kickoff",
      nextMilestoneDate: "2026-05-01",
    });
  });

  it("updates the current project snapshot from a weekly update", () => {
    const result = applyWeeklyUpdateToProject(
      {
        projectStage: "Not Started",
        health: "Grey",
        progressPercent: 0,
        managementUpdate: null,
        currentPosition: null,
        keyNextAction: null,
        pendingWith: null,
        mainBlockerRisk: null,
        lastUpdated: null,
        actualEndDate: null,
        nextMilestone: null,
        nextMilestoneDate: null,
      },
      {
        updateDate: "2026-04-21",
        stage: "In Progress",
        health: "Amber",
        progressPercent: 35,
        managementUpdate: "BRD approved; implementation is starting.",
        whatHappened: "BRD approved",
        nextStep: "Start implementation",
        blocker: "Vendor API timing",
      },
      [{ title: "Implementation", dueDate: "2026-04-30", status: "planned", sortOrder: 1 }],
    );

    expect(result.projectStage).toBe("In Progress");
    expect(result.health).toBe("Amber");
    expect(result.progressPercent).toBe(35);
    expect(result.managementUpdate).toBe("BRD approved; implementation is starting.");
    expect(result.currentPosition).toBe("BRD approved");
    expect(result.keyNextAction).toBe("Start implementation");
    expect(result.mainBlockerRisk).toBe("Vendor API timing");
    expect(result.lastUpdated).toBe("2026-04-21");
    expect(result.nextMilestone).toBe("Implementation");
  });

  it("closes the project snapshot when a weekly update is completed", () => {
    const result = applyWeeklyUpdateToProject(
      {
        projectStage: "In Progress",
        health: "Green",
        progressPercent: 95,
        managementUpdate: "Preparing for go-live.",
        currentPosition: "UAT complete.",
        keyNextAction: "Go live",
        pendingWith: "Vendor",
        mainBlockerRisk: "Deployment window",
        lastUpdated: "2026-07-24",
        actualEndDate: null,
        nextMilestone: "Go Live",
        nextMilestoneDate: "2026-07-31",
      },
      {
        updateDate: "2026-07-31",
        stage: "Completed",
        health: "Green",
        progressPercent: 95,
        managementUpdate: "The system is live and the project is complete.",
        currentPosition: "Go-live completed successfully.",
        whatHappened: "The system went live.",
        nextStep: "Transition to business-as-usual support.",
        blocker: "Should be cleared",
        pendingWith: "Should be cleared",
        nextMilestone: "Should be cleared",
        nextMilestoneDate: "2026-08-01",
      },
      [{ title: "Go Live", dueDate: "2026-07-31", status: "planned", sortOrder: 1 }],
    );

    expect(result).toMatchObject({
      projectStage: "Completed",
      progressPercent: 100,
      actualEndDate: "2026-07-31",
      mainBlockerRisk: null,
      pendingWith: null,
      nextMilestone: null,
      nextMilestoneDate: null,
    });
  });

  it("keeps milestone dates with their own titles and skips milestones that have completed", () => {
    const snapshot = {
      projectStage: "In Progress",
      health: "Green",
      progressPercent: null,
      managementUpdate: null,
      currentPosition: null,
      keyNextAction: null,
      pendingWith: null,
      mainBlockerRisk: null,
      lastUpdated: "2026-11-01",
      actualEndDate: null,
      nextMilestone: "Kickoff",
      nextMilestoneDate: "2026-11-03",
    };
    const update = {
      updateDate: "2026-11-02",
      stage: "In Progress",
      health: "Green",
      whatHappened: "Started delivery",
      nextStep: "Schedule testing",
    };
    const milestones = [
      { title: "Kickoff", dueDate: "2026-11-03", status: "completed", sortOrder: 1 },
      { title: "Testing", dueDate: "2026-12-10", status: "planned", sortOrder: 2 },
    ];
    expect(applyWeeklyUpdateToProject(snapshot, {
      ...update, nextMilestone: "Kickoff", nextMilestoneDate: "2026-11-03",
    }, milestones)).toMatchObject({
      nextMilestone: "Testing", nextMilestoneDate: "2026-12-10",
    });
    expect(applyWeeklyUpdateToProject(snapshot, {
      ...update, nextMilestone: "Launch",
    }, milestones)).toMatchObject({
      nextMilestone: "Launch", nextMilestoneDate: null, progressPercent: null,
    });
  });

  it("flags stale projects based on reporting frequency", () => {
    const staleDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 20)
      .toISOString()
      .slice(0, 10);

    expect(getLateDays(staleDate, "Weekly")).toBeGreaterThan(0);
    expect(getLateDays(staleDate, "On Demand")).toBe(0);
  });
});
