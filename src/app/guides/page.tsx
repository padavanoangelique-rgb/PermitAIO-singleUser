import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { RoleGuideChart } from "@/components/marketing/role-guide-chart";

export const metadata: Metadata = {
  title: "Role guides",
  description:
    "Step-by-step PermitAIO instructions for sales, measure, permit, HOA, warehouse, runner, install, accounting, admin, and homeowner.",
};

export default function GuidesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Role chart</p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            Click a role. See how they move the job.
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            One chart. Same steps as the printed cards. Text a role link — it opens this page on that tab.
          </p>
          <div className="mt-10">
            <RoleGuideChart />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
