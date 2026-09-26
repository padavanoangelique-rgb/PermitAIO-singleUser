import Link from "next/link";
import { CalendarClock, Package } from "lucide-react";
import { formatEtaDate } from "@/lib/inventory/eta";
import { FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

export type IncomingEtaJob = {
  id: string;
  jobNumber: string;
  client: string;
  tech: string;
  eta: string;
};

export type ReadyScheduleJob = {
  id: string;
  jobNumber: string;
  client: string;
  tech: string;
};

export type FieldOverviewData = {
  ready: ReadyScheduleJob[];
  incoming: IncomingEtaJob[];
};

const JOB_BTN =
  "inline-flex h-11 min-w-[7rem] items-center justify-center rounded-full bg-primary px-3 text-sm font-semibold tabular-nums text-primary-foreground shadow-sm sm:h-8";
const ROW =
  "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-1 py-1.5 hover:bg-muted/50";
const NAME_PILL =
  `inline-flex h-9 w-[13rem] min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_PURPLE}`;
const READY_PILL = `inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold shadow-sm sm:h-8 ${FILL_GREEN}`;
const ETA_PILL =
  "inline-flex h-11 items-center rounded-full bg-red-600 px-3 text-sm font-semibold tabular-nums text-white shadow-sm sm:h-8";

export function FieldOverview({ field }: { field: FieldOverviewData }) {
  return (
    <section className="space-y-3 print:hidden">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Field</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl px-3 py-3">
          <Link
            href="/install/schedule"
            className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-2xl font-semibold tabular-nums leading-tight text-primary">
                {field.ready.length}
              </p>
              <p className="text-xs text-muted-foreground">Ready to schedule</p>
            </div>
          </Link>

          {field.ready.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No jobs ready to schedule.</p>
          ) : (
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {field.ready.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className={ROW}>
                    <span className={JOB_BTN}>{job.jobNumber}</span>
                    <span className={NAME_PILL}>{job.client || "—"}</span>
                    <span className="text-sm text-muted-foreground">{job.tech || "Unassigned"}</span>
                    <span className={READY_PILL}>Ready</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm">
              <Package className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-2xl font-semibold tabular-nums leading-tight text-red-600 dark:text-red-400">
                {field.incoming.length}
              </p>
              <p className="text-xs text-muted-foreground">Expected in · under 2 weeks</p>
            </div>
          </div>

          {field.incoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No jobs with material inside two weeks.</p>
          ) : (
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {field.incoming.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className={ROW}>
                    <span className={JOB_BTN}>{job.jobNumber}</span>
                    <span className={NAME_PILL}>{job.client || "—"}</span>
                    <span className="text-sm text-muted-foreground">{job.tech || "Unassigned"}</span>
                    <span className={ETA_PILL}>{formatEtaDate(job.eta)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
