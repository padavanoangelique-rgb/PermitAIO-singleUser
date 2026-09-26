"use client";

import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { assignInstallJob, scheduleInstallJob } from "../actions";
import { person } from "../assign-picker";
import type { InstallMember } from "../install-dashboard";
import { FILL_AMBER, FILL_GREEN } from "@/lib/ui/fills";
import { CELL, JOB_BTN, NAME_PILL, PILL } from "../install-ui";

export type ScheduleRow = {
  id: string;
  job_number: string;
  client_name: string;
  address: string | null;
  city: string | null;
  permit_number: string | null;
  sub_status: string;
  permitApproved: boolean;
  hoaStatus: string;
  hoaApproved: boolean;
  checkedInAt: string;
  installerId: string | null;
  pmId: string | null;
  accountManagerId: string | null;
  scheduledDate: string | null;
};

const READY_GRID =
  "grid w-full grid-cols-[6.25rem_minmax(6rem,1fr)_minmax(5.5rem,8rem)_minmax(7rem,10rem)_auto] items-center gap-x-2";
const WAIT_GRID =
  "grid w-full grid-cols-[6.25rem_minmax(6rem,1fr)_minmax(5.5rem,8rem)_auto_auto] items-center gap-x-2";
const DATE = "h-8 w-[8.5rem] rounded-full border border-border bg-background px-3 text-sm";
const SELECT = "h-8 w-full min-w-0 rounded-full border border-border bg-background px-2 text-sm";
const SCHEDULE_BTN = `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_GREEN}`;

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ScheduleBoard({
  ready,
  waiting,
  installers,
}: {
  ready: ScheduleRow[];
  waiting: ScheduleRow[];
  pms: InstallMember[];
  installers: InstallMember[];
  accountManagers: InstallMember[];
  members: InstallMember[];
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Install manager</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Ready to schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">Warehouse in. Permit and HOA approved. Pick a date and tap Schedule now.</p>
      </header>

      <section className="space-y-1">
        <div className="flex items-center px-2 py-1.5">
          <span className={`flex min-w-0 flex-1 items-center justify-center rounded-full px-5 py-2 text-base font-bold shadow-sm ${FILL_GREEN}`}>
            Ready
            <span className="ml-2 font-bold tabular-nums opacity-90">({ready.length})</span>
          </span>
        </div>
        {ready.length === 0 ? (
          <p className="px-2 py-5 text-sm text-muted-foreground">
            Nothing ready to schedule. Jobs land here when warehouse checks them in and permit plus HOA are approved.
          </p>
        ) : (
          <>
            <div className={`${READY_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
              <span>Job #</span>
              <span>Client</span>
              <span>City</span>
              <span>Installer</span>
              <span>Schedule</span>
            </div>
            {ready.map((job) => (
              <div key={job.id} className={`${READY_GRID} rounded-xl px-2 py-1.5 hover:bg-muted/50`}>
                <Link href={`/jobs/${job.id}`} className={JOB_BTN} title={job.address || undefined}>
                  {job.job_number}
                </Link>
                <span className="min-w-0">
                  <span className={NAME_PILL} title={job.client_name}>
                    <span className="truncate">{job.client_name}</span>
                  </span>
                </span>
                <span className={`${CELL} truncate`} title={job.address || undefined}>
                  {job.city || "—"}
                </span>
                <form action={assignInstallJob}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="jobNumber" value={job.job_number} />
                  <input type="hidden" name="pmId" value={job.pmId ?? ""} />
                  <input type="hidden" name="next" value="/install/schedule" />
                  <input type="hidden" name="notice" value={`Assigned ${job.job_number}.`} />
                  <select
                    name="installerId"
                    defaultValue={job.installerId ?? ""}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className={SELECT}
                    aria-label="Installer"
                  >
                    <option value="">Installer</option>
                    {installers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {person(m)}
                      </option>
                    ))}
                  </select>
                </form>
                <form action={scheduleInstallJob} className="flex items-center gap-1.5 justify-self-end">
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="jobNumber" value={job.job_number} />
                  <input type="hidden" name="next" value="/install/schedule" />
                  <input type="date" name="scheduledDate" required defaultValue={job.scheduledDate || tomorrow()} className={DATE} />
                  <button type="submit" className={SCHEDULE_BTN}>
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Schedule now
                  </button>
                </form>
              </div>
            ))}
          </>
        )}
      </section>

      {waiting.length ? (
        <section className="space-y-1">
          <div className="flex items-center px-2 py-1.5">
            <span className={`flex min-w-0 flex-1 items-center justify-center rounded-full px-5 py-2 text-base font-bold shadow-sm ${FILL_AMBER}`}>
              Waiting on permit or HOA
              <span className="ml-2 font-bold tabular-nums opacity-90">({waiting.length})</span>
            </span>
          </div>
          <div className={`${WAIT_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
            <span>Job #</span>
            <span>Client</span>
            <span>City</span>
            <span>Permit</span>
            <span>HOA</span>
          </div>
          {waiting.map((job) => (
            <div key={job.id} className={`${WAIT_GRID} rounded-xl px-2 py-1.5`}>
              <Link href={`/jobs/${job.id}`} className={JOB_BTN}>
                {job.job_number}
              </Link>
              <span className="min-w-0">
                <span className={NAME_PILL} title={job.client_name}>
                  <span className="truncate">{job.client_name}</span>
                </span>
              </span>
              <span className={`${CELL} truncate`}>{job.city || "—"}</span>
              <span className={`${PILL} ${job.permitApproved ? FILL_GREEN : FILL_AMBER}`}>
                {job.permitApproved ? "Permit ok" : "Permit"}
              </span>
              <span className={`${PILL} ${job.hoaApproved ? FILL_GREEN : FILL_AMBER}`}>
                {job.hoaApproved ? (job.hoaStatus ? "HOA ok" : "No HOA") : "HOA"}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}