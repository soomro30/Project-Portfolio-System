import { redirect } from "next/navigation";

import { ReportsClient } from "@/components/reports/reports-client";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (user?.role === "portfolio_pm") {
    redirect("/project-status");
  }

  return <ReportsClient />;
}
