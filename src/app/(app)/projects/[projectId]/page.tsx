import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import { getCurrentUser } from "@/lib/auth/session";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  const user = await getCurrentUser();

  return (
    <ProjectDetailClient
      projectId={projectId}
      canManageAccess={user?.role === "admin"}
      canEdit={user?.role === "admin" || user?.role === "pm"}
    />
  );
}
