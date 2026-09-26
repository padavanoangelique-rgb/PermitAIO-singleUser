import { FILL_AMBER, FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

const PILL = "inline-flex h-8 items-center justify-center rounded-full px-3 text-sm font-semibold shadow-sm";
const JOB = "inline-flex h-8 min-w-[5.25rem] items-center justify-center rounded-full bg-primary px-2.5 text-sm font-semibold tabular-nums text-primary-foreground shadow-sm";

export function SoftWash() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute right-[-4rem] top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
    </div>
  );
}

export function JobStrip() {
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
      <span className={JOB}>26-1842</span>
      <span className={`${PILL} ${FILL_PURPLE}`}>Rivera</span>
      <span className="text-sm text-muted-foreground">Boca Raton</span>
      <span className={`${PILL} ${FILL_BLUE}`}>In Review</span>
      <span className={`${PILL} ${FILL_GREEN}`}>HOA Approved</span>
      <span className={`${PILL} ${FILL_AMBER}`}>ETA 9/28</span>
    </div>
  );
}

export function StatStrip() {
  const stats = [
    { n: "1", label: "Job number" },
    { n: "14", label: "Role apps" },
    { n: "3", label: "FL counties" },
    { n: "8", label: "Handoffs" },
  ];
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl bg-muted/60 px-4 py-4 text-center">
          <p className="font-heading text-2xl font-semibold tracking-tight">{s.n}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

export function ToolPills() {
  return (
    <div className="flex flex-wrap gap-2">
      <span className={`${PILL} ${FILL_PURPLE}`}>Forms Generator</span>
      <span className={`${PILL} ${FILL_BLUE}`}>Floor Plans</span>
      <span className={`${PILL} ${FILL_GREEN}`}>Permit Package</span>
    </div>
  );
}

const STEP_FILL = [FILL_PURPLE, FILL_BLUE, FILL_GREEN, FILL_AMBER];

export function StepBadge({ n, i }: { n: string; i: number }) {
  return (
    <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-semibold ${STEP_FILL[i % STEP_FILL.length]}`}>
      {n}
    </span>
  );
}