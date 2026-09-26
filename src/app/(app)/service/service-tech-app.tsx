"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ChevronDown, ChevronRight, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { APP_GRID, BTN_BLUE, CELL, JOB_BTN, NAME_PILL, PILL, TAP_GREEN } from "@/lib/ui/chrome";
import type { ServiceJob } from "./service-dashboard";
import { submitServiceTicket } from "./actions";

type UploadedFile = { id: string; file_name: string; storage_path: string; uploaded_at: string };

function FileUpload({ job, orgId }: { job: ServiceJob; orgId: string }) {
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
      .eq("category", "service_photo")
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
    const path = `${job.id}/service/${Date.now()}-${safe}`;
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
      category: "service_photo",
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
      <p className="flex items-center gap-2 text-sm font-medium">
        <Camera className="h-4 w-4" />
        Site photos
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_BLUE} onClick={() => inputRef.current?.click()} disabled={!!busy}>
          Take / upload photo
        </button>
        {!loaded ? (
          <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => void loadFiles()}>
            Show uploaded
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {busy ? <p className="text-xs text-muted-foreground">{busy}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {loaded ? (
        files.length === 0 ? (
          <p className="text-xs text-muted-foreground">No photos on this job yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {files.map((f) => (
              <li key={f.id}>
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => void openFile(f)}>
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

export type ServiceTicket = {
  id: string;
  job_id: string;
  job_number: string;
  service_tech_id: string | null;
  issue: string;
  photo_paths: string[] | null;
  submitted_at: string;
};

function TicketForm({
  job,
  techId,
  lastIssue,
}: {
  job: ServiceJob;
  techId: string | null;
  lastIssue?: string;
}) {
  return (
    <form action={submitServiceTicket} className="space-y-3 rounded-2xl border p-3">
      <input type="hidden" name="jobId" value={job.id} />
      <input type="hidden" name="jobNumber" value={job.job_number} />
      <input type="hidden" name="serviceTechId" value={techId ?? ""} />
      <label className="block text-sm font-medium">
        Issue
        <textarea
          name="issue"
          required
          minLength={3}
          rows={4}
          placeholder="What’s wrong — leak, glass, hardware, callback…"
          className="mt-1 block min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      {lastIssue ? <p className="text-xs text-muted-foreground">Last ticket: {lastIssue}</p> : null}
      <p className="text-xs text-muted-foreground">Upload photos first, then submit. They print on the manager report.</p>
      <button type="submit" className={TAP_GREEN}>
        Submit service ticket
      </button>
    </form>
  );
}

export function ServiceTechApp({
  jobs,
  mail,
  techName,
  orgId,
  techId,
  tickets,
}: {
  jobs: ServiceJob[];
  mail?: string;
  techName: string;
  orgId: string;
  techId: string | null;
  tickets: ServiceTicket[];
}) {
  const [locStatus, setLocStatus] = useState("");
  useEffect(() => {
    if (!techId || !navigator.geolocation) return;
    const db = createClient() as unknown as { from: (t: string) => { upsert: (v: unknown, o: { onConflict: string }) => Promise<{ error: { message: string } | null }> } };
    const send = () => { navigator.geolocation.getCurrentPosition(async (pos) => { const { error } = await db.from("service_tech_locations").upsert({ org_id: orgId, service_tech_id: techId, lat: pos.coords.latitude, lng: pos.coords.longitude, updated_at: new Date().toISOString() }, { onConflict: "org_id,service_tech_id" }); setLocStatus(error ? "Location not shared" : "Sharing your location with the office"); }, () => setLocStatus("Turn on location so the office can see you"), { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }); };
    send();
    const timer = window.setInterval(send, 45000);
    return () => window.clearInterval(timer);
  }, [orgId, techId]);
  const [openId, setOpenId] = useState<string | null>(jobs[0]?.id ?? null);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Service Tech</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {techName}. Write the issue, add photos, submit the ticket. No money on this app.
          </p>
        </div>
 </header>
      {mail ? <p className="text-sm text-emerald-700">{mail}</p> : null}
      <p className="text-sm text-muted-foreground">
        {jobs.length} job{jobs.length === 1 ? "" : "s"} assigned {locStatus ? "· " + locStatus : ""}
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
                  <span className={NAME_PILL}>{job.client_name}</span>
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
                    <FileUpload job={job} orgId={orgId} />
                    <TicketForm
                      job={job}
                      techId={techId}
                      lastIssue={tickets.find((t) => t.job_id === job.id)?.issue}
                    />
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
