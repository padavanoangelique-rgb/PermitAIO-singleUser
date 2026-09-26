"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Receipt, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { jobLat } from "./install-map";
import type { InstallJob } from "./install-dashboard";
import { FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { BTN_BLUE, BTN_PURPLE, APP_GRID, CELL, JOB_BTN, NAME_PILL, PILL, TAP_BLUE, TAP_GREEN } from "./install-ui";

function googleRouteUrl(jobs: InstallJob[]) {
  const ordered = [...jobs].filter((j) => j.address || j.city).sort((a, b) => jobLat(b) - jobLat(a));
  const stops = ordered.map((j) => encodeURIComponent([j.address, j.city].filter(Boolean).join(", ")));
  if (stops.length === 0) return null;
  if (stops.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${stops[0]}&travelmode=driving`;
  }
  const dest = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
}

type UploadedFile = { id: string; file_name: string; storage_path: string; uploaded_at: string };

function FileUpload({ job, orgId, category, label }: { job: InstallJob; orgId: string; category: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function loadFiles() {
    const supabase = createClient();
    const { data, error: listError } = await supabase
      .from("job_files")
      .select("id, file_name, storage_path, uploaded_at")
      .eq("org_id", orgId)
      .eq("job_id", job.id)
      .eq("category", category)
      .order("uploaded_at", { ascending: false });
    if (listError) {
      setError(listError.message);
      return;
    }
    setFiles((data ?? []) as UploadedFile[]);
    setLoaded(true);
  }

  async function upload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setBusy("Uploading…");
    setError("");
    const supabase = createClient();
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${job.id}/${Date.now()}-${safe}`;
    const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file, { contentType: file.type });
    if (uploadError) {
      setError(uploadError.message);
      setBusy("");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("job_files").insert({
      org_id: orgId,
      job_id: job.id,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      uploaded_by: auth.user?.id ?? null,
      category,
    });
    if (insertError) {
      setError(insertError.message);
      setBusy("");
      return;
    }
    setBusy("");
    await loadFiles();
  }

  async function openFile(file: UploadedFile) {
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage.from("job-files").createSignedUrl(file.storage_path, 60);
    if (signError || !data) {
      setError(signError?.message ?? "Couldn't open that file.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <span className={`${PILL} ${category === "installer_invoice" ? FILL_PURPLE : FILL_GREEN}`}>{label}</span>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy} className={TAP_BLUE}>
          {busy || `Upload ${label.toLowerCase()}`}
        </button>
        {!loaded ? (
          <button type="button" className={`${PILL} text-muted-foreground hover:bg-muted`} onClick={() => void loadFiles()}>
            Show uploaded
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {loaded ? (
        files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {label.toLowerCase()} on this job yet.</p>
        ) : (
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.id}>
                <button type="button" className={BTN_PURPLE} onClick={() => void openFile(f)}>
                  {f.file_name}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function InstallerApp({
  jobs,
  mail,
  installerName,
  orgId,
}: {
  jobs: InstallJob[];
  mail?: string;
  installerName: string;
  orgId: string;
}) {
  const routeUrl = googleRouteUrl(jobs);
  const [openId, setOpenId] = useState<string | null>(jobs[0]?.id ?? null);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Installer</h1>
          <p className="text-sm text-muted-foreground">Signed in as {installerName}. Only jobs assigned to you.</p>
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
        {jobs.length} job{jobs.length === 1 ? "" : "s"} assigned
      </p>
      {jobs.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No jobs assigned to you yet.</p>
      ) : (
        <div className="space-y-0.5">
          <div className={`${APP_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
            <span />
            <span>Job #</span>
            <span>Client</span>
            <span className="hidden sm:block">City</span>
          </div>
          {jobs.map((job) => {
            const open = openId === job.id;
            return (
              <article key={job.id}>
                <button type="button" onClick={() => setOpenId(open ? null : job.id)} className={`${APP_GRID} cursor-pointer rounded-xl px-2 py-1.5 text-left hover:bg-muted/40`}>
                  {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className={JOB_BTN}>{job.job_number}</span>
                  <span className={`${NAME_PILL}`}>{job.client_name}</span>
                  <span className={`${CELL} hidden sm:block`}>{job.city || job.address || "—"}</span>
                </button>
                {open ? (
                  <div className="space-y-3 px-8 pb-3">
                    <p className="text-sm text-muted-foreground">
                      {[job.address, job.city].filter(Boolean).join(", ") || "No address"}
                    </p>
                    <Link href={`/jobs/${job.id}`} className={BTN_BLUE}>
                      Job details
                    </Link>
                    <FileUpload job={job} orgId={orgId} category="installer_invoice" label="Invoice" />
                    <FileUpload job={job} orgId={orgId} category="material_receipt" label="Material receipt" />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
