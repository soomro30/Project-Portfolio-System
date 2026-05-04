import { notFound } from "next/navigation";

import { AdminClient } from "@/components/admin/admin-client";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    notFound();
  }

  return <AdminClient />;
}
