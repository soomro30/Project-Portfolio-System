import { ProjectsClient } from "@/components/projects/projects-client";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ProjectsPage() {
  const user = await getCurrentUser();

  return <ProjectsClient canCreateProjects={user?.role === "admin"} />;
}
