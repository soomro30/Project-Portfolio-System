import { redirect } from "next/navigation";

import { AppShellFrame } from "@/components/app-shell/app-shell-frame";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShellFrame user={user}>{children}</AppShellFrame>;
}
