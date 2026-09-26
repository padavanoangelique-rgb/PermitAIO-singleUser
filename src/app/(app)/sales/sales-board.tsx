"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { StatusView, type StatusPayload } from "@/components/sales/status-view";
import { FIELD_TOOLS } from "@/lib/field-tools";
import { addSalesNote, emailHomeownerLink } from "./actions";
import { BTN_BLUE, BTN_GREEN, FIELD, LOOKUP, TAP_BLUE, TAP_GREEN } from "@/lib/ui/chrome";

export type SalesFile = { id: string; file_name: string; storage_path: string; uploaded_at: string };
export type SalesNote = { id: string; message: string; created_at: string };

const AREA = "mt-1 block w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground";

export function SalesBoard({
  lookup,
  notFound,
  mail,
  tableNote,
  status,
  jobId,
  orgId,
  trackUrl,
  files,
  notes,
}: {
  lookup: string;
  notFound: boolean;
  mail?: string;
  tableNote?: string;
  status: StatusPayload | null;
  jobId: string | null;
  orgId: string | null;
  trackUrl: string | null;
  files: SalesFile[];
  notes: SalesNote[];
}) {
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function copyLink() {
    if (!trackUrl) return;
    await navigator.clipboard.writeText(trackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onFile(file: File | undefined) {
    if (!file || !jobId || !orgId) return;
    setUploading(true);
    setUploadError("");
    const supabase = createClient();
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${jobId}/${Date.now()}-${safe}`;
    const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
    if (uploadError) {
      setUploadError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("job_files").insert({
      org_id: orgId,
      job_id: jobId,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      uploaded_by: auth.user?.id ?? null,
      category: "sales",
    });
    if (insertError) {
      setUploadError(insertError.message);
      setUploading(false);
      return;
    }
    window.location.reload();
  }

  async function openFile(file: SalesFile) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("job-files").createSignedUrl(file.storage_path, 60);
    if (error || !data) {
      setUploadError(error?.message ?? "Couldn't open that file.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Sales</h1>
        <p className="text-sm text-muted-foreground">
          Type a job number. Same clean status the homeowner sees, plus notes, documents, and a link you can text or email.</p><p className="text-sm"><Link href="/service?app=request&source=sales" className="text-primary underline-offset-2 hover:underline">Request service</Link>
        </p>
      </div>

      {mail ? <p className="text-sm text-emerald-700">{mail}</p> : null}
      {tableNote ? <p className="text-sm text-amber-700">{tableNote}</p> : null}

      <form method="get" action="/sales" className={LOOKUP}>
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
        {status ? (
          <a href="/sales" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline">
            Clear
          </a>
        ) : null}
      </form>

      {notFound ? <p className="text-sm text-amber-700">No job matches “{lookup}”.</p> : null}
      {!status && !notFound ? <p className="text-sm text-muted-foreground">Nothing on this screen until a job number is pulled.</p> : null}

      {status && jobId ? (
        <>
          <StatusView data={status} audience="sales" jobId={jobId} requesterRole="Sales" returnTo="/sales" />

          <section className="space-y-3 px-1 py-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Note for this job</h2>
            <p className="text-sm text-muted-foreground">Shows on the job’s Activity & notes. Homeowners do not see this.</p>
            <form action={addSalesNote} className="space-y-3">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="jobNumber" value={status.jobNumber} />
              <textarea name="note" required rows={3} placeholder="Write a note…" className={AREA} />
              <button className={TAP_BLUE} type="submit">
                Save note
              </button>
            </form>
            {notes.length ? (
              <ul className="space-y-2 text-sm">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-2xl px-3 py-2">
                    <p>{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="border-t pt-3">
              <h3 className="text-sm font-medium">Upload PDF</h3>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="mt-2 block text-sm"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              {uploading ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
              {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
              {files.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No PDFs on this job yet.</p> : null}
              <ul className="mt-2 space-y-1 text-sm">
                {files.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => void openFile(f)}>
                      {f.file_name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="space-y-3 px-1 py-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer link</h2>
            <p className="text-sm text-muted-foreground">Copy for a text, or email it. Homeowners see status only — no notes, no login.</p>
            {trackUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-full bg-muted px-3 py-2 text-xs">{trackUrl}</code>
                <button type="button" onClick={() => void copyLink()} className={BTN_BLUE}>
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-amber-700">Run the homeowner link SQL in Supabase so a token can be created.</p>
            )}
            <form action={emailHomeownerLink} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="jobNumber" value={status.jobNumber} />
              <input type="hidden" name="clientName" value={status.clientName} />
              <input type="hidden" name="address" value={status.address} />
              <label className="text-xs">
                Email to
                <input name="email" type="email" required placeholder="homeowner@email.com" className={`${FIELD} min-w-[240px]`} />
              </label>
              <button className={TAP_GREEN} type="submit">
                Send email
              </button>
            </form>
          </section>
        </>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg">Field tools</h2>
            <p className="text-sm text-muted-foreground">Same calculators as the Tools page. No ads.</p>
          </div>
          <Link href="/tools" className="text-sm text-primary underline-offset-2 hover:underline">
            Open Tools
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELD_TOOLS.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="rounded-2xl px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <p className="font-heading text-sm font-semibold">{t.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
