"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FolderOpen, Loader2, Trash2, Upload } from "lucide-react";

type Job = Tables<"jobs">;
type JobFile = Tables<"job_files">;

/**
 * Generic "Documents" tab for a job — supporting files (photos, sealed
 * plans, correspondence, etc.) that don't belong to any specific tool.
 * Reads job_files across every category so it also displays rows the
 * Permit Inventory panel already created (category = "permit-inventory"),
 * but those rows are shown read-only here — this panel never edits or
 * deletes Permit Inventory's own attachments, only its own uploads.
 */
export function JobDocumentsPanel({ job }: { job: Job }) {
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("job_files")
      .select("*")
      .eq("org_id", job.org_id)
      .eq("job_id", job.id)
      .order("uploaded_at", { ascending: false });
    setFiles(data ?? []);
    setLoading(false);
  }, [job.id, job.org_id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    for (const file of Array.from(fileList)) {
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${job.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
      if (uploadError) {
        setError(`Couldn't upload ${file.name}: ${uploadError.message}`);
        continue;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("job_files").insert({
        org_id: job.org_id,
        job_id: job.id,
        file_name: file.name,
        storage_path: path,
        size_bytes: file.size,
        uploaded_by: auth.user?.id ?? null,
        category: "supporting-doc",
      });
      if (insertError) {
        await supabase.storage.from("job-files").remove([path]);
        setError(`Couldn't save ${file.name}: ${insertError.message}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    await load();
  }

  async function handleDownload(file: JobFile) {
    const supabase = createClient();
    const { data, error: signErr } = await supabase.storage
      .from("job-files")
      .createSignedUrl(file.storage_path, 60);
    if (signErr || !data) {
      setError(`Couldn't open that file: ${signErr?.message ?? "unknown error"}`);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(file: JobFile) {
    if (!confirm(`Remove "${file.file_name}" from this job?`)) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("job_files")
      .delete()
      .eq("id", file.id)
      .eq("org_id", job.org_id);
    if (deleteError) {
      setError(`Couldn't remove that file: ${deleteError.message}`);
      return;
    }
    await supabase.storage.from("job-files").remove([file.storage_path]);
    await load();
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base">Documents</CardTitle>
            <p className="text-sm text-muted-foreground">
              Supporting files for this job — photos, sealed plans, correspondence, anything
              that doesn&apos;t belong in Floor Plans, Forms, or NOAs. Included as supporting
              documents in the Permit Package Generator.
            </p>
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : "Upload file"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {files.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <FolderOpen className="h-6 w-6" />
              <p className="text-sm">No documents uploaded yet.</p>
            </div>
          ) : (
            files.map((file) => {
              const isPermitInventory = file.category === "permit-inventory";
              return (
                <div
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{file.file_name}</p>
                      {isPermitInventory && (
                        <Badge variant="secondary" className="text-xs">
                          Permit Inventory
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatSize(file.size_bytes)} ·{" "}
                      {new Date(file.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleDownload(file)}>
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    {!isPermitInventory && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(file)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
