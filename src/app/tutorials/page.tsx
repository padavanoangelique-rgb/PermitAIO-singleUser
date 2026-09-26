import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PlaybookView } from "@/components/marketing/playbook-view";

export const metadata: Metadata = {
  title: "Tutorials — every role, every click",
  description:
    "PermitAIO tutorials by role: what to click, which reports to print, and which agents to use. Sales, measure, permit, HOA, warehouse, runner, install, service, accounting, admin, homeowner.",
};

export default function TutorialsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 px-4 py-12 sm:px-6 md:px-10 md:py-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <header>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">PermitAIO</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              How to use it — every role
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Pipeline: Sales → Measure → Permit → HOA → Warehouse → Runner → Install → Service. Same job number the whole way.
            </p>
          </header>
          <PlaybookView />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
