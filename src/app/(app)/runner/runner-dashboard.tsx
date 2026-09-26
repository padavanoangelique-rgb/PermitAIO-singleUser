"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, Send, UserPlus } from "lucide-react";
import { sendJobToRunner, addRunnerMember } from "./actions";
import { APP_GRID, CELL, FIELD, JOB_BTN, NAME_PILL, TAP_BLUE, TAP_GREEN } from "@/lib/ui/chrome";
import { FILL_BLUE, FILL_GREEN } from "@/lib/ui/fills";

export type RunnerJob = {
  id: string;
  job_number: string;
  client_name: string;
  address: string | null;
  city: string | null;
  jurisdiction: string | null;
};

export type RunnerMember = {
  id: string;
  email: string;
  user_id: string | null;
  display_name: string | null;
};

export type RunnerRun = {
  id: string;
  job_id: string;
  job_number: string;
  place: string;
  note: string | null;
  runner_id: string | null;
  assigned_by_email: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
};

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

function memberLabel(m?: RunnerMember) {
  if (!m) return "Unassigned";
  return m.display_name?.trim() || m.email;
}

function statusChip(run: RunnerRun) {
  if (run.checked_in_at && run.checked_out_at) {
    return { label: `Done · ${formatDuration(run.checked_in_at, run.checked_out_at)}`, className: FILL_GREEN };
  }
  if (run.checked_in_at) {
    return { label: "En route", className: FILL_BLUE };
  }
  return { label: "Not started", className: "bg-muted text-muted-foreground" };
}

export function RunnerDashboard({
  jobs,
  roster,
  runs,
  mail,
  tableNote,
  orgName,
}: {
  jobs: RunnerJob[];
  roster: RunnerMember[];
  runs: RunnerRun[];
  mail?: string;
  tableNote?: string;
  orgName: string;
}) {
  const [jobId, setJobId] = useState("");
  const selectedJob = jobs.find((j) => j.id === jobId);
  const suggestedPlace = selectedJob ? selectedJob.jurisdiction || selectedJob.address || "" : "";
  const memberById = new Map(roster.map((m) => [m.id, m]));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{orgName}</p>
        <h1 className="mt-1 font-heading text-3xl text-foreground">Permit Runner</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Hand a job to the runner with the place she's headed and a note. She only sees the job number, the place, and
          your note — nothing else.
        </p>
      </header>

      {mail ? <p className="text-sm text-emerald-700">{mail}</p> : null}
      {tableNote ? <p className="text-sm text-amber-700">{tableNote}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Send className="h-4 w-4" />
            Send a job to the runner
          </p>
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a runner to the roster first.</p>
          ) : (
            <form action={sendJobToRunner} className="grid gap-3">
              <label className="text-xs">
                Job
                <select name="jobId" value={jobId} onChange={(e) => setJobId(e.target.value)} className={FIELD}>
                  <option value="">Select job number</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.job_number} · {job.client_name}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="jobNumber" value={selectedJob?.job_number ?? ""} />
              <label className="text-xs">
                Place
                <input key={jobId} name="place" required defaultValue={suggestedPlace} placeholder="City Hall, HOA office, etc." className={FIELD} />
              </label>
              <label className="text-xs">
                Note
                <textarea name="note" rows={2} placeholder="What she needs to do there" className="mt-1 block w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" />
              </label>
              {roster.length > 1 ? (
                <label className="text-xs">
                  Runner
                  <select name="runnerId" required defaultValue="" className={FIELD}>
                    <option value="" disabled>
                      Pick a runner
                    </option>
                    {roster.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="runnerId" value={roster[0]?.id ?? ""} />
              )}
              <button className={`${TAP_BLUE} w-fit disabled:opacity-50`} type="submit" disabled={!jobId}>
                Send
              </button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <UserPlus className="h-4 w-4" />
            Add crew
          </p>
          <form action={addRunnerMember} className="grid gap-3">
            <label className="text-xs">
              Email
              <input name="email" type="email" required className={FIELD} />
            </label>
            <label className="text-xs">
              Name
              <input name="displayName" className={FIELD} />
            </label>
            <button className={`${TAP_GREEN} w-fit`} type="submit">
              Add to roster
            </button>
          </form>
          {roster.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {roster.map((m) => (
                <li key={m.id}>
                  {memberLabel(m)}
                  {m.user_id ? null : " · not signed in yet"}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl">Runs</h2>
          <Link href="/runner/report" className={TAP_BLUE}>
            <Printer className="h-4 w-4" />
            Print report
          </Link>
        </div>
        {runs.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="space-y-0.5">
            <div className={`${APP_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
              <span />
              <span>Job #</span>
              <span>Place</span>
              <span className="hidden sm:block">Status</span>
            </div>
            {runs.map((run) => {
              const chip = statusChip(run);
              const runner = run.runner_id ? memberById.get(run.runner_id) : undefined;
              return (
                <article key={run.id} className={`${APP_GRID} rounded-xl px-2 py-1.5`}>
                  <span />
                  <span className={JOB_BTN}>{run.job_number}</span>
                  <span className={`${NAME_PILL}`}>{run.place}</span>
                  <span className={`${CELL} hidden sm:flex items-center gap-2`}>
                    <span className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold ${chip.className}`}>{chip.label}</span>
                    <span className="truncate text-muted-foreground">{memberLabel(runner)}</span>
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
