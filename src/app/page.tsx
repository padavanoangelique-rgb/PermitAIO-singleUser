import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { HomeRest } from "@/components/marketing/home-rest";
import { SalesBot } from "@/components/sales-bot";
import { DemoPreview } from "@/components/marketing/demo-preview";
import { BuilderDemoPreview } from "@/components/marketing/builder-demo-preview";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

const homeTitle = "PermitAIO — One job. Every role.";
const homeOgDescription =
  "The permit operating system for South Florida window, door, and roofing contractors. One job number from measure to inspection.";

export const metadata: Metadata = {
  title: homeTitle,
  description:
    "PermitAIO is the operating system for South Florida window, door, and roofing contractors. Role-based apps, permit packages, HOA, warehouse, install, and accounting — one job number from measure to inspection.",
  openGraph: {
    title: homeTitle,
    description: homeOgDescription,
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "PermitAIO — One job. Every role." }],
  },
};

const modules = [
  { pill: FILL_BLUE, label: "Dashboard", copy: "Permit techs, HOA techs, and account managers on one board. Scheduled, inspection, pending final. Material ETA and ready-to-schedule." },
  { pill: FILL_PURPLE, label: "Permit Inventory", copy: "Job number, client, city, permit + HOA status, both techs, contract value. Dates and status change on the row." },
  { pill: FILL_GREEN, label: "HOA Tracker", copy: "Same job rows as inventory. Application, send to the association, notes, directory, certificates." },
  { pill: FILL_PURPLE, label: "Permit Builder", copy: "One floor plan per job. Forms generator, floor plans, and permit package — techs share the drawing." },
  { pill: FILL_BLUE, label: "Libraries", copy: "NOAs and forms grouped by county. Contractor registration packets live here too." },
  { pill: FILL_GREEN, label: "Contractors", copy: "COI for liability and workers comp, expiration dates, city dropdowns, registration email." },
  { pill: FILL_BLUE, label: "Install", copy: "Payments, change orders, job checks, photos, permit in and out. Ready to schedule, installer, PM, account manager." },
  { pill: FILL_PURPLE, label: "Field apps", copy: "Measure, warehouse, permit runner, sales lookup, customer status link. Same job number." },
  { pill: FILL_GREEN, label: "Accounting", copy: "Live ledger of every fee receipt. Installer invoices next to it. Admin and accounting only." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
      
        <DemoPreview />

        <BuilderDemoPreview />

        <section className="px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-3xl">
            <p className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_PURPLE}`}>
              What it is
            </p>
            <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Permit to inspection. Not a CRM.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Sales looks up the job. Measure shoots the openings. Permit builds the package. HOA clears the association. Warehouse checks product in against the NOA list. Install schedules only when permit and HOA are clear. Accounting sees the receipts. Same job number the whole way.
            </p>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Built for Broward, Miami-Dade, and Palm Beach window, door, and roofing shops. Each person gets the app for their job — not the whole office.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tutorials"
                className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold"
              >
                Role tutorials
              </Link>
              <Link
                href="/guides"
                className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold"
              >
                Role guides
              </Link>
              <Link
                href="/join"
                className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold"
              >
                Join your company
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 bg-muted/40 px-4 py-16 sm:px-6 md:px-10 md:py-24">
          <div className="mx-auto max-w-3xl">
            <p className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_BLUE}`}>
              What you get
            </p>
            <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              The whole office, already on the job
            </h2>
            <p className="mt-3 text-muted-foreground">
              No extra spreadsheet. The next person gets the work the moment the last step clears.
            </p>
            <ul className="mt-10">
              {modules.map((m) => (
                <li
                  key={m.label}
                  className="grid gap-2 border-t border-border/80 py-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center sm:gap-8"
                >
                  <span className={`inline-flex h-8 w-fit items-center rounded-full px-3 text-sm font-semibold shadow-sm ${m.pill}`}>
                    {m.label}
                  </span>
                  <p className="text-sm leading-relaxed text-muted-foreground">{m.copy}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <HomeRest />
      </main>
      <SiteFooter />
      <SalesBot />
    </div>
  );
}
