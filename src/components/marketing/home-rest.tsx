import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { ZipAssemblyDiagram } from "@/components/marketing/zip-assembly-diagram";
import { StepBadge, ToolPills } from "@/components/marketing/landing-marks";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

const TAP = "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold shadow-sm";

const pipeline = [
  { n: "01", title: "Measured", detail: "Openings, photos, and the wall layout land on the job number from the field." },
  { n: "02", title: "Permitted", detail: "Floor plan, county forms, and matched NOAs. Package generates in a few clicks." },
  { n: "03", title: "Tracked", detail: "Permit inventory shows submitted, in review, approved, printed." },
  { n: "04", title: "HOA in", detail: "Association packet submitted and followed. Ready cannot fire until HOA is clear." },
  { n: "05", title: "Warehouse", detail: "Product checked against the official NOA list. Alert when it is ready to install." },
  { n: "06", title: "Assigned", detail: "Install manager assigns. PM routes, photos, inspection date." },
  { n: "07", title: "Installed", detail: "Installer uploads from the field. Payments, checks, and photos stay on the job." },
  { n: "08", title: "Closed", detail: "Passed inspection, receipts on the ledger, no extra report to rebuild." },
];

const counties = [
  { name: "Broward", fill: FILL_PURPLE },
  { name: "Miami-Dade", fill: FILL_BLUE },
  { name: "Palm Beach", fill: FILL_GREEN },
];

export function HomeRest() {
  return (
    <>
      <section className="bg-muted/40 px-4 py-16 sm:px-6 md:px-10 md:py-24">
        <div className="mx-auto max-w-5xl">
          <p className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_GREEN}`}>Pipeline</p>
          <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Beginning to end. Nothing re-entered.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Measure. Permit. HOA. Warehouse. Assign. Route. Photo. Inspect. Close.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pipeline.map((step, i) => (
              <li key={step.n}>
                <StepBadge n={step.n} i={i} />
                <h3 className="mt-3 font-heading text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="counties" className="scroll-mt-16 px-4 py-10 sm:px-6 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Jurisdiction-aware forms for South Florida's busiest permitting counties
          </p>
          <div className="flex flex-wrap gap-2">
            {counties.map((c) => (
              <span key={c.name} className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${c.fill}`}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 md:px-10 md:py-24">
        <div className="mx-auto max-w-5xl">
          <ToolPills />
          <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Everything the jurisdiction needs, zipped in a few clicks
          </h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start">
            <ZipAssemblyDiagram />
            <div>
              <BrowserFrame
                src="/screenshots/permit-package.png"
                alt="Permit builder with Forms Generator, Floor Plans, and Permit Package"
                caption="Permit builder"
                width={1814}
                height={599}
              />
              <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                {[
                  "Readiness checklist flags what's missing before you generate",
                  "Every version is stored — download or re-generate any job's ZIP",
                  "Matched NOAs are the same list the warehouse checks in against",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-muted/40 px-4 py-16 text-center sm:px-6 md:px-10 md:py-20">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            <span className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_PURPLE}`}>Sales</span>
            <span className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_BLUE}`}>Permit</span>
            <span className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_GREEN}`}>Install</span>
          </div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Give every role the next step — not another report
          </h2>
          <Link href="/signup" className={`${TAP} ${FILL_BLUE} mt-8 w-full max-w-xs sm:w-auto`}>
            Start your free trial <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}