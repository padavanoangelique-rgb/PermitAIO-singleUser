"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { addInstallMember, assignInstallJob, scheduleInstallJob } from "./actions";
import { AssignPicker } from "./assign-picker";
import type { InstallAssignment, InstallJob, InstallMember } from "./install-dashboard";
import { FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { BTN_BLUE, BTN_GREEN, APP_GRID, CELL, FIELD, JOB_BTN, NAME_PILL, PILL } from "./install-ui";

function AccountManagerJobRow({
  job,
  assignment,
  pms,
  installers,
  open,
  onToggle,
}: {
  job: InstallJob;
  assignment?: InstallAssignment;
  pms: InstallMember[];
  installers: InstallMember[];
  open: boolean;
  onToggle: () => void;
}) {
  const currentPm = assignment?.pm_id ?? "";
  const currentInstaller = assignment?.installer_id ?? "";
  return (
    <article>
      <button type="button" onClick={onToggle} className={`${APP_GRID} cursor-pointer rounded-xl px-2 py-1.5 text-left hover:bg-muted/40`}>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className={JOB_BTN}>{job.job_number}</span>
        <span className={`${NAME_PILL}`}>{job.client_name}</span>
        <span className={`${CELL} hidden sm:block`}>{job.city || job.address || "—"}</span>
      </button>
      {open ? (
        <div className="space-y-3 px-8 pb-3">
          <AssignPicker
            label="Project manager"
            action={assignInstallJob}
            hiddenFields={{ jobId: job.id, jobNumber: job.job_number, installerId: currentInstaller }}
            fieldName="pmId"
            currentId={assignment?.pm_id}
            options={pms}
          />
          <AssignPicker
            label="Installer"
            action={assignInstallJob}
            hiddenFields={{ jobId: job.id, jobNumber: job.job_number, pmId: currentPm }}
            fieldName="installerId"
            currentId={assignment?.installer_id}
            options={installers}
          />
          <form action={scheduleInstallJob} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="jobNumber" value={job.job_number} />
            <label className="text-xs text-muted-foreground">
              Scheduled date
              <input type="date" name="scheduledDate" defaultValue={assignment?.scheduled_date ?? ""} className={FIELD} />
            </label>
            <button type="submit" className={BTN_GREEN}>
              Save
            </button>
          </form>
          <Link href={`/jobs/${job.id}`} className={BTN_BLUE}>
            Job details
          </Link>
        </div>
      ) : null}
    </article>
  );
}

function AddInstaller() {
  return (
    <div className="space-y-2 pt-4">
      <p className={`${PILL} ${FILL_GREEN}`}>Add an installer</p>
      <p className="text-sm text-muted-foreground">
        New to the crew? Add their name and email — they'll show up in the Installer picker above once they sign in.
      </p>
      <form action={addInstallMember} className="grid max-w-xl gap-3 sm:grid-cols-2">
        <input type="hidden" name="role" value="installer" />
        <input type="hidden" name="next" value="/install?app=account_manager" />
        <label className="text-xs">
          Name
          <input name="displayName" className={FIELD} />
        </label>
        <label className="text-xs">
          Email
          <input name="email" type="email" required className={FIELD} />
        </label>
        <button type="submit" className={`${BTN_GREEN} sm:col-span-2 w-fit`}>
          Add installer
        </button>
      </form>
    </div>
  );
}

export function AccountManagerApp({
  jobs,
  assignments,
  pms,
  installers,
  mail,
  accountManagerName,
}: {
  jobs: InstallJob[];
  assignments: InstallAssignment[];
  pms: InstallMember[];
  installers: InstallMember[];
  mail?: string;
  accountManagerName: string;
}) {
  const byJob = new Map(assignments.map((a) => [a.job_id, a]));
  const [openId, setOpenId] = useState<string | null>(jobs[0]?.id ?? null);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Account manager</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {accountManagerName}. Assign a project manager and installer to each job below.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href="/install/status" className={`${PILL} ${FILL_PURPLE}`}>
            Permit/HOA status
          </Link>
          <Link href="/install/calendar" className={BTN_BLUE}>
            Calendar
          </Link>
          <Link href="/install/invoices" className={BTN_GREEN}>
            Installer invoices
          </Link>
        </div>
      </header>
      {mail ? <p className="text-sm text-emerald-700">{mail}</p> : null}
      <p className="text-sm text-muted-foreground">
        {jobs.length} job{jobs.length === 1 ? "" : "s"} assigned to you
      </p>
      {jobs.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No jobs assigned to you yet. The install manager assigns jobs to you from Ready to Schedule.
        </p>
      ) : (
        <div className="space-y-0.5">
          <div className={`${APP_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
            <span />
            <span>Job #</span>
            <span>Client</span>
            <span className="hidden sm:block">City</span>
          </div>
          {jobs.map((job) => (
            <AccountManagerJobRow
              key={job.id}
              job={job}
              assignment={byJob.get(job.id)}
              pms={pms}
              installers={installers}
              open={openId === job.id}
              onToggle={() => setOpenId((id) => (id === job.id ? null : job.id))}
            />
          ))}
        </div>
      )}
      <AddInstaller />
    </div>
  );
}
