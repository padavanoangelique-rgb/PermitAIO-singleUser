"use client";

import { useState } from "react";
import { runDataAgentUpload } from "@/lib/actions/data-agent";
import { DATA_AGENT_INSTRUCTIONS, type DataAgentInstruction } from "@/lib/agents/data-agent/types";
import { useTechSlots } from "@/components/tech-slots-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CsvUploadForm({
  open,
  onOpenChange,
  orgId,
  userId,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  onUploaded: () => void;
}) {
  const { permitTechs } = useTechSlots();
  const [tech, setTech] = useState(permitTechs[1] ?? permitTechs[0]);
  const [instruction, setInstruction] = useState<DataAgentInstruction>("fill_missing");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a CSV file first.");
    setUploading(true);
    setError(null);
    try {
      const text = await file.text();
      const result = await runDataAgentUpload(instruction, tech, text);
      if (!result.ok) {
        setError(result.error ?? "Couldn't process that file.");
        setUploading(false);
        return;
      }
      setPreview({ inserted: result.inserted ?? 0, updated: result.updated ?? 0, skipped: result.skipped ?? 0 });
      setUploading(false);
      onUploaded();
    } catch (err) {
      setError(`Couldn't read that file (${err instanceof Error ? err.message : "unknown error"}). Make sure it's a .csv file.`);
      setUploading(false);
    }
  }

  const instructionHint: Record<DataAgentInstruction, string> = {
    add_new_jobs: "Creates a job for every job number in the file that doesn't exist yet. Existing job numbers are left untouched.",
    update_status: 'Sets the status on jobs the file already has a "status" column for. A job currently in Engineering Pending is never changed.',
    update_dates: "Fills in assigned/submitted/approved/sale dates that are currently blank. Never overwrites a date that's already set.",
    fill_missing: "Fills in any blank field (address, permit #, contract value, etc.) on jobs that already exist, and adds any brand-new job numbers. Never touches stage, status, or assigned tech.",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleUpload}>
          <DialogHeader>
            <DialogTitle className="font-heading">Upload jobs spreadsheet</DialogTitle>
            <DialogDescription>Upload a CSV file of jobs. In Excel, use File → Save As → CSV.</DialogDescription>
          </DialogHeader>
          <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Expected headers (any order; extras ignored): client_name, job_number, address, folio_number, trade_type, contract_value, permit_number, jurisdiction, status, sale_date, assigned_date, submitted_date, approved_date, notes</p>
          <div className="grid gap-4 py-5 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-3">
              <Label>What should this upload do?</Label>
              <Select value={instruction} onValueChange={(value) => setInstruction(value as DataAgentInstruction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATA_AGENT_INSTRUCTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{instructionHint[instruction]}</p>
            </div>
            <div className="space-y-2"><Label>Assign to</Label><Select value={tech} onValueChange={setTech}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{permitTechs.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="inventory-csv-file">CSV File</Label><Input id="inventory-csv-file" type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          {preview && (
            <p className="mb-3 text-sm text-chart-3">
              Added {preview.inserted} new job{preview.inserted === 1 ? "" : "s"} to {tech}.
              {preview.updated > 0 && ` Updated ${preview.updated} existing job${preview.updated === 1 ? "" : "s"}.`}
              {preview.skipped > 0 && ` Skipped ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} — see the job's activity log for why.`}
            </p>
          )}
          <DialogFooter><Button type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
