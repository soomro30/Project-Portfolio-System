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
        currentPosition: null,
        keyNextAction: null,
        mainBlockerRisk: null,
        lastUpdated: null,
        nextMilestone: null,
        nextMilestoneDate: null,
      },
      {
        updateDate: "2026-04-21",
        stage: "In Progress",
        health: "Amber",
        whatHappened: "BRD approved",
        nextStep: "Start implementation",
        blocker: "Vendor API timing",
      },
      [{ title: "Implementation", dueDate: "2026-04-30", status: "planned", sortOrder: 1 }],
    );

    expect(result.projectStage).toBe("In Progress");
    expect(result.health).toBe("Amber");
    expect(result.currentPosition).toBe("BRD approved");
    expect(result.keyNextAction).toBe("Start implementation");
    expect(result.mainBlockerRisk).toBe("Vendor API timing");
    expect(result.lastUpdated).toBe("2026-04-21");
    expect(result.nextMilestone).toBe("Implementation");
  });

  it("flags stale projects based on reporting frequency", () => {
    const staleDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 20)
      .toISOString()
      .slice(0, 10);

    expect(getLateDays(staleDate, "Weekly")).toBeGreaterThan(0);
    expect(getLateDays(staleDate, "On Demand")).toBe(0);
  });
});
