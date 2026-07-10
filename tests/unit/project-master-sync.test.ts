import { describe, expect, it } from "vitest";

import { buildMasterCurrentPositionFromUpdates } from "../../src/lib/domain/project-master-sync";

describe("project master sync narrative", () => {
  it("preserves custom narrative sections during sync", () => {
    const narrative = buildMasterCurrentPositionFromUpdates(
      [
        {
          updateDate: "2026-06-12",
          stage: "In Progress",
          health: "Green",
          currentPosition: "Week 2 is 75% complete.",
          whatHappened: "Week 2 is 75% complete.",
          nextStep: "Proceed into Week 3.",
          blocker: "SOW signature is pending.",
          pendingWith: "IMKAN Procurement",
        },
      ],
      [
        "As of 01 Jun 2026, the project is In Progress with Green health.",
        "",
        "Current Status:",
        "Kickoff completed.",
        "",
        "Implementation Milestones:",
        "- Week 1, 1-7 June: Completed.",
        "- Week 2, 8-14 June: In progress.",
      ].join("\n"),
    );

    expect(narrative).toContain("Implementation Milestones:");
    expect(narrative).toContain("- Week 1, 1-7 June: Completed.");
    expect(narrative).toContain("- Week 2, 8-14 June: In progress.");
  });

  it("rebuilds the implementation milestones section from milestone records", () => {
    const narrative = buildMasterCurrentPositionFromUpdates(
      [
        {
          updateDate: "2026-06-12",
          stage: "In Progress",
          health: "Green",
          currentPosition: "Week 2 is 75% complete.",
          whatHappened: "Week 2 is 75% complete.",
          nextStep: "Proceed into Week 3.",
          blocker: "SOW signature is pending.",
          pendingWith: "IMKAN Procurement",
        },
      ],
      null,
      [
        {
          title: "Implementation Week 1: Vendor onboarding and virtual account setup",
          dueDate: "2026-06-07",
          notes:
            "Week 1 focus: vendor onboarding, virtual account setup, KYC pipeline, and vendor email notifications. Completed.",
          sortOrder: 13,
          status: "completed",
        },
        {
          title: "Implementation Week 2: PO and invoice tracking updates",
          dueDate: "2026-06-14",
          notes:
            "Week 2 focus: PO receiver, PO update receiver, invoice tracking, and invoice status updates. 75% complete as of 12 June 2026.",
          sortOrder: 14,
          status: "in_progress",
        },
        {
          title: "Go Live",
          dueDate: "2026-07-21",
          notes: "Final go-live milestone.",
          sortOrder: 19,
          status: "planned",
        },
      ],
    );

    expect(narrative).toContain("Implementation Milestones:");
    expect(narrative).toContain("- Week 1, 1-7 Jun:");
    expect(narrative).toContain("- Week 2, 8-14 Jun:");
    expect(narrative).toContain("- Go Live, 21 Jul 2026: Final go-live milestone.");
  });
});
