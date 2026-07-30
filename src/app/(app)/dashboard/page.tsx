import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/reports/dashboard-client";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (user?.role === "portfolio_pm" || user?.role === "viewer") {
    redirect("/project-status");
  }

  return <DashboardClient />;
}
