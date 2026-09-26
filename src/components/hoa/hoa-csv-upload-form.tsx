"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { csvRecords, mapHoaImportRows, planHoaJobImportRows } from "@/lib/hoa/csv";
import type { Tables } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Hoa = Tables<"hoas">;

export function HoaCsvUploadForm({
  open,
  onOpenChange,
  mode,
  orgId,
  hoas,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "hoa" | "job";
  orgId: string;
  hoas: Hoa[];
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ added: number; updated: number; skipped: number; linked?: number } | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a CSV file first.");
    setUploading(true);
    setError(null);
    try {
      const records = csvRecords(await file.text());
      if (records.length === 0) {
        setUploading(false);
        return setError("No rows found — check the file has a header row plus data.");
      }
      const supabase = createClient();
      if (mode === "hoa") {
        const results = mapHoaImportRows(records, orgId, hoas.map((h) => h.name));
        const toInsert = results.filter((r) => r.row).map((r) => r.row!);
        const skipped = results.length - toInsert.length;
        if (toInsert.length > 0) {
          const { error: insertError } = await supabase.from("hoas").insert(toInsert);
          if (insertError) {
            setUploading(false);
            return setError(insertError.message);
          }
        }
        setPreview({ added: toInsert.length, updated: 0, skipped });
      } else {
        // Look up existing Permit Inventory jobs, this org's existing HOA
        // Tracker jobs, and already-linked HOA submissions so matching job
        // numbers are either filled in (if the HOA job already exists) or
        // attached to the real job (job_id) on insert, without ever
        // double-linking a single job.
        const [{ data: jobsData, error: jobsError }, { data: existingHoaJobs, error: hoaJobsError }, { data: linkedData, error: linkedError }] = await Promise.all([
          supabase.from("jobs").select("id, job_number").eq("org_id", orgId),
          supabase.from("hoa_jobs").select("*").eq("org_id", orgId),
          supabase.from("hoa_jobs").select("job_id").eq("org_id", orgId).not("job_id", "is", null),
        ]);
        if (jobsError || hoaJobsError || linkedError) {
          setUploading(false);
          return setError((jobsError ?? hoaJobsError ?? linkedError)!.message);
        }
        const alreadyLinkedJobIds = (linkedData ?? []).map((r) => r.job_id).filter((id): id is string => !!id);
        const plan = planHoaJobImportRows(records, orgId, hoas, jobsData ?? [], existingHoaJobs ?? [], alreadyLinkedJobIds);
        const toInsert = plan.filter((p) => p.action === "insert").map((p) => p.insertRow!);
        const toUpdate = plan.filter((p) => p.action === "update");
        const skipped = plan.filter((p) => p.action === "skip").length;
        const linked = toInsert.filter((r) => r.job_id).length;
        if (toInsert.length > 0) {
          const { error: insertError } = await supabase.from("hoa_jobs").insert(toInsert);
          if (insertError) {
            setUploading(false);
            return setError(insertError.message);
          }
        }
        for (const row of toUpdate) {
          const { error: updateError } = await supabase.from("hoa_jobs").update(row.updatePatch!).eq("id", row.existingId!);
          if (updateError) {
            setUploading(false);
            return setError(updateError.message);
          }
        }
        setPreview({ added: toInsert.length, updated: toUpdate.length, skipped, linked });
      }
      setUploading(false);
      onImported();
    } catch (err) {
      setUploading(false);
      setError(`Couldn't read that file (${err instanceof Error ? err.message : "unknown error"}). Make sure it's a .csv file.`);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFile(null);
          setError(null);
          setPreview(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleUpload}>
          <DialogHeader>
            <DialogTitle className="font-heading">{mode === "hoa" ? "Upload HOA CSV" : "Upload Jobs CSV"}</DialogTitle>
            <DialogDescription>
              {mode === "hoa"
                ? "Columns: name, mgmtCo, contactName, phone, email, address, qualifications, notes. Existing HOAs (matched by name) are skipped."
                : "Columns: hoaName, jobNumber, jobName, address, status, assignedTo, assignedDate, dateSubmitted, dateApproved, notes. hoaName must match an existing HOA. assignedTo should be Tech 1, Tech 2, or Tech 3. Rows whose jobNumber matches an existing Permit Inventory job are linked to that job automatically."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="hoa-csv-file">CSV file</Label>
            <Input id="hoa-csv-file" type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          {preview && (
            <p className="mb-2 text-sm text-chart-3">
              Added {preview.added}, filled in missing fields on {preview.updated}, skipped {preview.skipped}
              {typeof preview.linked === "number" && preview.linked > 0
                ? ` (${preview.linked} automatically linked to a matching Permit Inventory job).`
                : "."}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
