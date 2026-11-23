import { redirect } from "next/navigation";

import { ProjectPresentationDashboard } from "@/components/projects/project-presentation-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { getProjectsForReports } from "@/lib/domain/projects";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export const dynamic = "force-dynamic";

export default async function ProjectDashboardPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { projectId } = await params;
  const [project] = await getProjectsForReports(user, [projectId]);

  if (!project) {
    redirect("/projects");
  }

  return (
    <ProjectPresentationDashboard
      project={{
        id: project.id,
        projectCode: project.projectCode,
        projectName: project.projectName,
        projectStage: project.projectStage,
        pmName: project.pmName,
        projectDescription: project.projectDescription,
        startDate: project.startDate,
        endDate: project.endDate,
        actualEndDate: project.actualEndDate,
        projectSponsor: project.projectSponsor,
        health: project.health,
        currentPosition: project.currentPosition,
        keyNextAction: project.keyNextAction,
        pendingWith: project.pendingWith,
        mainBlockerRisk: project.mainBlockerRisk,
        nextMilestone: project.nextMilestone,
        nextMilestoneDate: project.nextMilestoneDate,
        lastUpdated: project.lastUpdated,
        progressPercent: project.progressPercent,
        milestones: project.milestones.map(({ id, title, dueDate, status, sortOrder, completedAt }) => ({
          id, title, dueDate, status, sortOrder, completedAt: completedAt?.toISOString() ?? null,
        })),
        risks: project.risks.map(({ id, title, description, owner, mitigationPlan, status, severity, targetDate, sortOrder }) => ({
          id, title, description, owner, mitigationPlan, status, severity, targetDate, sortOrder,
        })),
      }}
    />
  );
}
