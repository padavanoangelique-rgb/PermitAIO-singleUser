import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { PrintButton } from "@/components/print-button";

type RunRow = {
  id: string;
  job_number: string;
  place: string;
  note: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function mondayIso() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

function durationMinutes(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0;
}

function formatMinutes(total: number) {
  if (total === 0) return "—";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function RunnerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const params = await searchParams;
  const today = todayIso();
  const from = params.from || today;
  const to = params.to || today;

  const supabase = await createClient();
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          gte: (a: string, b: string) => {
            lte: (a: string, b: string) => {
              order: (a: string, o: { ascending: boolean }) => Promise<{ data: RunRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };

  const { data: rows } = await db
    .from("runner_jobs")
    .select("id, job_number, place, note, checked_in_at, checked_out_at, created_at")
    .eq("org_id", activeOrg.id)
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)
    .order("created_at", { ascending: true });

  const runs = rows ?? [];

  const byPlace = new Map<string, { rows: RunRow[]; minutes: number }>();
  for (const run of runs) {
    const key = run.place;
    const entry = byPlace.get(key) ?? { rows: [], minutes: 0 };
    entry.rows.push(run);
    entry.minutes += durationMinutes(run.checked_in_at, run.checked_out_at);
    byPlace.set(key, entry);
  }
  const grandTotalMinutes = runs.reduce((sum, r) => sum + durationMinutes(r.checked_in_at, r.checked_out_at), 0);

  const rangeLabel = from === to ? new Date(`${from}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : `${from} – ${to}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Permit runner</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Runner report</h1>
          <p className="text-sm text-muted-foreground">Time at each place for the selected range.</p>
        </div>
        <PrintButton />
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block h-10 rounded-full border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
          <label className="text-xs">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 block h-10 rounded-full border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
          <button type="submit" className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm">
            Apply
          </button>
        </form>
        <a href="/runner/report" className="text-sm text-primary underline-offset-2 hover:underline">
          Today
        </a>
        <a href={`/runner/report?from=${mondayIso()}&to=${today}`} className="text-sm text-primary underline-offset-2 hover:underline">
          This week
        </a>
      </div>

      <p className="text-sm font-medium">{rangeLabel}</p>

      {runs.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No runs in this range.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Job</th>
                  <th className="px-4 py-2">Place</th>
                  <th className="px-4 py-2">Note</th>
                  <th className="px-4 py-2">Check in</th>
                  <th className="px-4 py-2">Check out</th>
                  <th className="px-4 py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {[...byPlace.entries()].map(([place, entry]) => (
                  <Fragment key={place}>
                    {entry.rows.map((run, i) => (
                      <tr key={run.id} className="border-t">
                        <td className="px-4 py-2 font-medium">{run.job_number}</td>
                        <td className="px-4 py-2">{i === 0 ? place : ""}</td>
                        <td className="px-4 py-2 text-muted-foreground">{run.note ?? ""}</td>
                        <td className="px-4 py-2">{formatTime(run.checked_in_at)}</td>
                        <td className="px-4 py-2">{formatTime(run.checked_out_at)}</td>
                        <td className="px-4 py-2">{formatMinutes(durationMinutes(run.checked_in_at, run.checked_out_at))}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/20">
                      <td className="px-4 py-2" colSpan={5}>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Total at {place}</span>
                      </td>
                      <td className="px-4 py-2 font-medium">{formatMinutes(entry.minutes)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-right text-sm font-medium">Grand total: {formatMinutes(grandTotalMinutes)}</p>
        </>
      )}
    </div>
  );
}
