import { WeeklyUpdateForm } from "@/components/weekly/weekly-update-form";
import { redirect } from "next/navigation";

import { AppBreadcrumbs } from "@/components/navigation/app-breadcrumbs";
import { getCurrentUser } from "@/lib/auth/session";

export default async function WeeklyUpdatePage() {
  const user = await getCurrentUser();

  if (user?.role === "viewer") {
    redirect("/dashboard");
  }

  return (
    <div className="app-page">
      <section className="app-page__hero">
        <AppBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Weekly Update" },
          ]}
        />
        <p className="app-page__eyebrow">Weekly reporting</p>
        <h1 className="app-page__title">Weekly Update</h1>
        <p className="app-page__subtitle">
          PMs submit this form once per reporting cycle, and the platform automatically updates the current project tracker snapshot.
        </p>
      </section>
      <WeeklyUpdateForm />
    </div>
  );
}
