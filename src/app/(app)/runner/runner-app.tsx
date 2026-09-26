"use client";

import { Clock } from "lucide-react";
import { checkInRun, checkOutRun } from "./actions";
import type { RunnerRun } from "./runner-dashboard";
import { APP_GRID, CELL, JOB_BTN, NAME_PILL, TAP_BLUE, TAP_GREEN } from "@/lib/ui/chrome";
import { FILL_GREEN } from "@/lib/ui/fills";

function formatTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return "";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function RunnerApp({
  runs,
  runnerName,
  mail,
}: {
  runs: RunnerRun[];
  runnerName: string;
  mail?: string;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Permit Runner</p>
        <h1 className="mt-1 font-heading text-3xl text-foreground">Hi {runnerName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your runs — job number, where to go, and any note.</p>
      </header>

      {mail ? <p className="text-sm text-emerald-700">{mail}</p> : null}

      {runs.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No runs assigned to you yet.</p>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const inProgress = run.checked_in_at && !run.checked_out_at;
            const done = run.checked_in_at && run.checked_out_at;
            return (
              <article key={run.id} className="space-y-3 px-1 py-2">
                <div className={`${APP_GRID}`}>
                  <span />
                  <span className={JOB_BTN}>{run.job_number}</span>
                  <span className={`${NAME_PILL}`}>{run.place}</span>
                  <span className={`${CELL} hidden sm:block`}>{done ? "Done" : inProgress ? "En route" : "Not started"}</span>
                </div>
                {run.note ? <p className="px-8 text-sm text-muted-foreground">{run.note}</p> : null}

                <div className="px-8">
                  {!run.checked_in_at ? (
                    <form action={checkInRun}>
                      <input type="hidden" name="runId" value={run.id} />
                      <button type="submit" className={`${TAP_GREEN} w-full`}>
                        Check in
                      </button>
                    </form>
                  ) : inProgress ? (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Checked in {formatTime(run.checked_in_at)}
                      </p>
                      <form action={checkOutRun}>
                        <input type="hidden" name="runId" value={run.id} />
                        <button type="submit" className={`${TAP_BLUE} w-full`}>
                          Check out
                        </button>
                      </form>
                    </div>
                  ) : done ? (
                    <p className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${FILL_GREEN}`}>
                      <Clock className="h-4 w-4" />
                      Done — {formatDuration(run.checked_in_at, run.checked_out_at)}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
