import { redirect } from "next/navigation";

import { ProjectPresentationDashboard } from "@/components/projects/project-presentation-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { getProjectForUser } from "@/lib/domain/projects";

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
  const project = await getProjectForUser(user, projectId);

  if (!project) {
    redirect("/projects");
  }

  return (
    <ProjectPresentationDashboard
      project={JSON.parse(JSON.stringify(project))}
    />
  );
}
