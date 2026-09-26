"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, ChevronDown, ChevronRight, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkInstallJob } from "./actions";
import { jobLat } from "./install-map";
import type { InstallAssignment, InstallJob } from "./install-dashboard";
import { buildPmPhotoReportPdf } from "@/lib/install/photo-report-pdf";
import { BTN_BLUE, BTN_PURPLE, APP_GRID, CELL, JOB_BTN, NAME_PILL, PILL, TAP_BLUE, TAP_GREEN, TAP_PURPLE } from "./install-ui";

function googleRouteUrl(jobs: InstallJob[]) {
  const ordered = [...jobs]
    .filter((j) => j.address || j.city)
    .sort((a, b) => jobLat(b) - jobLat(a));
  const stops = ordered.map((j) => encodeURIComponent([j.address, j.city].filter(Boolean).join(", ")));
  if (stops.length === 0) return null;
  if (stops.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${stops[0]}&travelmode=driving`;
  }
  const dest = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
}

export function PmApp({
  jobs,
  assignments,
  mail,
  pmName,
}: {
  jobs: InstallJob[];
  assignments: InstallAssignment[];
  mail?: string;
  pmName: string;
}) {
  const byJob = useMemo(() => new Map(assignments.map((a) => [a.job_id, a])), [assignments]);
  const ongoing = jobs.filter((job) => {
    const result = byJob.get(job.id)?.inspection_result;
    return result !== "passed" && result !== "failed";
  });
  const routeUrl = googleRouteUrl(ongoing);
  const [openId, setOpenId] = useState<string | null>(ongoing[0]?.id ?? null);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Project manager</h1>
          <p className="text-sm text-muted-foreground">Signed in as {pmName}. Only jobs assigned to you.</p>
        </div>
        <a
          href={routeUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className={`${routeUrl ? TAP_GREEN : `${PILL} bg-muted text-muted-foreground`} ${!routeUrl ? "pointer-events-none" : ""}`}
        >
          <Route className="h-3.5 w-3.5" />
          Best route this morning
        </a>
      </header>
      {mail ? <p className="text-sm text-emerald-700">{mail}</p> : null}
      <p className="text-sm text-muted-foreground">
        {ongoing.length} ongoing · {jobs.length} assigned
      </p>
      {ongoing.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No ongoing jobs assigned to you.</p>
      ) : (
        <div className="space-y-0.5">
          <div className={`${APP_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
            <span />
            <span>Job #</span>
            <span>Client</span>
            <span className="hidden sm:block">City</span>
          </div>
          {ongoing.map((job) => {
            const open = openId === job.id;
            return (
              <article key={job.id}>
                <button type="button" onClick={() => setOpenId(open ? null : job.id)} className={`${APP_GRID} cursor-pointer rounded-xl px-2 py-1.5 text-left hover:bg-muted/40`}>
                  {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className={JOB_BTN}>{job.job_number}</span>
                  <span className={`${NAME_PILL}`}>{job.client_name}</span>
                  <span className={`${CELL} hidden sm:block`}>{job.city || job.address || "—"}</span>
                </button>
                {open ? <PmJobBody job={job} assignment={byJob.get(job.id)} pmName={pmName} /> : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PmJobBody({
  job,
  assignment,
  pmName,
}: {
  job: InstallJob;
  assignment?: InstallAssignment;
  pmName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ name: string; path: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function loadPhotos() {
    const supabase = createClient();
    const { data, error: listError } = await supabase.storage.from("job-files").list(`${job.id}/pm-photos`);
    if (listError) {
      setError(listError.message);
      return;
    }
    setPhotos((data ?? []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => ({ name: f.name, path: `${job.id}/pm-photos/${f.name}` })));
    setLoaded(true);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("Uploading…");
    setError("");
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${job.id}/pm-photos/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("job-files").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError(upErr.message);
        setBusy("");
        return;
      }
    }
    setBusy("");
    await loadPhotos();
  }

  async function makePdf() {
    setBusy("Building PDF…");
    setError("");
    if (!loaded) await loadPhotos();
    const supabase = createClient();
    const list = photos.length
      ? photos
      : ((await supabase.storage.from("job-files").list(`${job.id}/pm-photos`)).data ?? [])
          .filter((f) => f.name && !f.name.startsWith("."))
          .map((f) => ({ name: f.name, path: `${job.id}/pm-photos/${f.name}` }));
    if (list.length === 0) {
      setError("Upload photos first.");
      setBusy("");
      return;
    }
    const embedded: { bytes: Uint8Array; name: string }[] = [];
    for (const photo of list) {
      const { data } = await supabase.storage.from("job-files").download(photo.path);
      if (!data) continue;
      embedded.push({ bytes: new Uint8Array(await data.arrayBuffer()), name: photo.name });
    }
    const bytes = await buildPmPhotoReportPdf({
      jobNumber: job.job_number,
      clientName: job.client_name,
      address: [job.address, job.city].filter(Boolean).join(", "),
      pmName,
      photos: embedded,
    });
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.job_number}-photo-report.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy("");
  }

  return (
    <div className="space-y-3 px-8 pb-3">
      <div className="flex flex-wrap gap-2">
        <form action={checkInstallJob}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="jobNumber" value={job.job_number} />
          <input type="hidden" name="next" value="/install?app=pm" />
          <button type="submit" className={assignment?.pm_checked_at ? TAP_PURPLE : TAP_GREEN}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {assignment?.pm_checked_at ? "Checked in · tap to update" : "Check in"}
          </button>
        </form>
        <button type="button" className={TAP_BLUE} onClick={() => inputRef.current?.click()}>
          <Camera className="h-3.5 w-3.5" />
          Upload photos
        </button>
        <button type="button" className={TAP_PURPLE} onClick={() => void makePdf()} disabled={!!busy}>
          {busy || "Photo report PDF"}
        </button>
        <Link href={`/jobs/${job.id}`} className={BTN_BLUE}>
          Job details
        </Link>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {assignment?.pm_checked_at ? (
        <p className="text-sm text-muted-foreground">
          Last check-in {new Date(assignment.pm_checked_at).toLocaleString("en-US", { timeZone: "America/New_York" })}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {loaded ? (
        <p className="text-sm text-muted-foreground">
          {photos.length} photo{photos.length === 1 ? "" : "s"} on this job
        </p>
      ) : (
        <button type="button" className={`${PILL} text-muted-foreground hover:bg-muted`} onClick={() => void loadPhotos()}>
          Show photos
        </button>
      )}
    </div>
  );
}
