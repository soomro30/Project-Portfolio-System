import { ProjectStatusBoard } from "@/components/projects/project-status-board";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ProjectStatusPage() {
  const user = await getCurrentUser();

  return (
    <ProjectStatusBoard
      showDashboardBreadcrumb={user?.role !== "portfolio_pm" && user?.role !== "viewer"}
    />
  );
}
