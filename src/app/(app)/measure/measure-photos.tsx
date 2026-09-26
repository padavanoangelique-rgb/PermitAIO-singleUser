"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, FileUp, Printer, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteMeasureFile, type MeasureFile } from "./actions";
import { JOB_BTN, NAME_PILL, TAP_BLUE, TAP_GREEN, TAP_PURPLE } from "@/lib/ui/chrome";

async function toUploadFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return file;
  if (file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg")) {
    return file;
  }
  try {
    const bmp = await createImageBitmap(file);
    const max = 2400;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function MeasurePhotos({
  jobId,
  jobNumber,
  clientName,
  address,
  orgId,
  files,
}: {
  jobId: string;
  jobNumber: string;
  clientName: string;
  address: string;
  orgId: string;
  files: MeasureFile[];
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    try {
      for (const raw of Array.from(list)) {
        const file = await toUploadFile(raw);
        const safe = file.name.replace(/[^\w.\-]/g, "_");
        const path = `${jobId}/measure/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("job-files").upload(path, file);
        if (upErr) throw new Error(upErr.message);
        const { error: insErr } = await supabase.from("job_files").insert({
          org_id: orgId,
          job_id: jobId,
          file_name: file.name,
          storage_path: path,
          size_bytes: file.size,
          uploaded_by: auth.user?.id ?? null,
          category: "measure",
        });
        if (insErr) throw new Error(insErr.message);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that file.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-3 py-3">
        <Link href={`/measure?job=${encodeURIComponent(jobNumber)}`} aria-label="Done" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-muted">
          <X className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={JOB_BTN}>Job {jobNumber}</span>
          <span className={`${NAME_PILL} min-w-0 truncate`}>{clientName || "Field photos"}</span>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 pb-28">
        <p className="text-sm text-muted-foreground">
          {clientName || address || "Shoot the existing plan, openings, and any marked-up sheets. Attach a PDF if they already have one."}
        </p>

        {error ? <p className="mt-3 text-sm text-amber-700">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className={TAP_PURPLE}
          >
            <Camera className="h-4 w-4" />
            Take photo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={TAP_BLUE}
          >
            <FileUp className="h-4 w-4" />
            Attach PDF
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />

        <ul className="mt-5 space-y-2">
          {files.length === 0 ? (
            <li className="text-sm text-muted-foreground">No sheets on this job yet.</li>
          ) : (
            files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded-2xl px-2 py-2 text-sm">
                <span className="min-w-0 truncate">{f.file_name}</span>
                <button
                  type="button"
                  className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                  onClick={async () => {
                    await deleteMeasureFile(f.id, f.storage_path);
                    window.location.reload();
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))
          )}
        </ul>
        {busy ? <p className="mt-3 text-sm text-muted-foreground">Saving…</p> : null}
      </div>

      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <a
          href={`/measure/pdf?jobId=${jobId}`}
          target="_blank"
          rel="noreferrer"
          className={`${TAP_GREEN} w-full`}
        >
          <Printer className="size-4" />
          Print PDF of images
        </a>
      </div>
    </div>
  );
}
