"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MergedNoaEntry } from "@/lib/noa/merge";
import { deleteNoaEntry } from "@/lib/actions/noa";
import { downloadPdfFromSignedUrl } from "@/lib/noa/download-pdf";
import { EditNoaDialog } from "./edit-noa-dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, X } from "lucide-react";

export function NoaRowActions({
  entry,
  isAdmin,
}: {
  entry: MergedNoaEntry;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const looksLikePdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) {
      setError("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${entry.org_id}/${entry.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("noa-library")
      .upload(path, file);
    if (upErr) {
      setUploading(false);
      setError(`Couldn't upload that file: ${upErr.message}`);
      return;
    }
    if (entry.storage_path) {
      await supabase.storage.from("noa-library").remove([entry.storage_path]);
    }
    const { error: dbErr } = await supabase
      .from("noa_library")
      .update({ file_name: file.name, storage_path: path })
      .eq("id", entry.id);
    setUploading(false);
    if (dbErr) {
      setError(`Couldn't save that file: ${dbErr.message}`);
      return;
    }
    router.refresh();
  }

  async function handleDownload() {
    if (!entry.storage_path) return;
    setDownloading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signErr } = await supabase.storage
      .from("noa-library")
      .createSignedUrl(entry.storage_path, 60);
    if (signErr || !data) {
      setDownloading(false);
      setError(`Couldn't open that file: ${signErr?.message ?? "unknown error"}`);
      return;
    }
    try {
      const name =
        entry.file_name ||
        `${entry.manufacturer}-${entry.noa_number || "NOA"}.pdf`;
      await downloadPdfFromSignedUrl(data.signedUrl, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that PDF.");
    }
    setDownloading(false);
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete the NOA for "${entry.manufacturer}${
          entry.series ? " " + entry.series : ""
        }" permanently? This removes it from every job's NOA Downloader.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    const res = await deleteNoaEntry(entry.id);
    setDeleting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const hasFile = Boolean(entry.storage_path);
  const canReplaceFile = entry.can_edit_entry;

  return (
    <div className="flex shrink-0 items-center justify-end gap-0.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      {canReplaceFile && (
        <Button
          variant="ghost"
          size="sm"
          disabled={uploading}
          title={hasFile ? "Replace PDF" : "Upload PDF"}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>
      )}
      {hasFile && (
        <Button
          variant="ghost"
          size="sm"
          disabled={downloading}
          title="Download PDF"
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
      {entry.can_edit_entry ? <EditNoaDialog entry={entry} isAdmin={isAdmin} /> : null}
      {entry.can_edit_entry && (
        <Button
          variant="ghost"
          size="sm"
          disabled={deleting}
          onClick={handleDelete}
          title="Delete this NOA"
        >
          <X className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
      {error && (
        <span className="max-w-[10rem] truncate text-xs text-destructive" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
