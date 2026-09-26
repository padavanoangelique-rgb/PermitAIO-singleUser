"use client";

import Link from "next/link";
import { Camera, PenLine } from "lucide-react";
import { MeasureApp } from "./measure-app";
import { MeasurePhotos } from "./measure-photos";
import type { Plan } from "@/lib/measure/types";
import type { MeasureFile } from "./actions";
import { FILL_BLUE, FILL_PURPLE } from "@/lib/ui/fills";
import { FIELD, JOB_BTN, LOOKUP, NAME_PILL, TAP_BLUE } from "@/lib/ui/chrome";

export function MeasureBoard({
  lookup,
  notFound,
  tableNote,
  mode,
  orgId,
  files,
  job,
}: {
  lookup: string;
  notFound: boolean;
  tableNote?: string;
  mode: string;
  orgId: string;
  files: MeasureFile[];
  job: {
    jobId: string;
    jobNumber: string;
    clientName: string;
    address: string;
    plan: Plan | null;
  } | null;
}) {
  if (job && mode === "draw") {
    return (
      <div className="measure-app fixed inset-0 z-[80] bg-background">
        <MeasureApp
          jobs={[]}
          host={{
            jobNumber: job.jobNumber,
            address: job.address,
            plan: job.plan,
          }}
        />
      </div>
    );
  }

  if (job && mode === "photos") {
    return (
      <MeasurePhotos
        jobId={job.jobId}
        jobNumber={job.jobNumber}
        clientName={job.clientName}
        address={job.address}
        orgId={orgId}
        files={files}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Measure Tech</h1>
        <p className="text-sm text-muted-foreground">
          Type a job number. Draw the house, or attach photos and a PDF of the existing plan.
        </p>
      </div>

      {tableNote ? <p className="text-sm text-amber-700">{tableNote}</p> : null}

      <form method="get" action="/measure" className={LOOKUP}>
        <label className="text-sm font-medium">
          Job number
          <input
            name="job"
            defaultValue={lookup}
            autoFocus
            autoComplete="off"
            placeholder="92300-1"
            className={`${FIELD} min-w-[220px] font-mono text-base`}
          />
        </label>
        <button className={TAP_BLUE} type="submit">
          Pull job
        </button>
        {job ? (
          <a href="/measure" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline">
            Clear
          </a>
        ) : null}
      </form>

      {notFound ? (
        <p className="text-sm text-amber-700">No job matches “{lookup}”. Check the job number and try again.</p>
      ) : null}

      {!job && !notFound ? (
        <p className="text-sm text-muted-foreground">Nothing on this screen until a job number is pulled.</p>
      ) : null}

      {job ? (
        <section className="space-y-4">
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={JOB_BTN}>{job.jobNumber}</span>
              <span className={NAME_PILL}>{job.clientName || `Job ${job.jobNumber}`}</span>
            </div>
            <p className="text-sm text-muted-foreground">{job.address || "No address"}</p>
          </header>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/measure?job=${encodeURIComponent(job.jobNumber)}&mode=draw`}
              className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${FILL_PURPLE}`}
            >
              <PenLine className="h-4 w-4" />
              Draw the house
            </Link>
            <Link
              href={`/measure?job=${encodeURIComponent(job.jobNumber)}&mode=photos`}
              className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${FILL_BLUE}`}
            >
              <Camera className="h-4 w-4" />
              Photos & PDF{files.length ? ` · ${files.length}` : ""}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
