"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { STAGES } from "@/lib/inventory/constants";
import { HOA_JOB_STATUSES, NO_HOA_TECH } from "@/lib/hoa/constants";
import { useTechSlots } from "@/components/tech-slots-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Job = Tables<"jobs">;

const ROW_COUNT = 10;
const NONE = "__none__";
const PLACEHOLDER_HOA_NAME = "Unassigned - Pending HOA Info";

type Row = {
  job_number: string;
  client_name: string;
  permit_tech: string;
  hoa_tech: string;
};

export function BulkJobForm({
  open,
  onOpenChange,
  orgId,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  onCreated: (jobs: Job[]) => void;
}) {
  const { permitTechs, hoaTechs } = useTechSlots();
  const emptyRow = (): Row => ({ job_number: "", client_name: "", permit_tech: permitTechs[0], hoa_tech: NONE });
  const emptyRows = (): Row[] => Array.from({ length: ROW_COUNT }, emptyRow);

  const [rows, setRows] = useState<Row[]>(emptyRows);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((previous) => previous.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const activeRows = rows.filter((row) => row.job_number.trim() && row.client_name.trim());
    if (activeRows.length === 0) {
      setError("Enter at least a job number and client name for one row.");
      return;
    }
    const seen = new Set<string>();
    for (const row of activeRows) {
      const key = row.job_number.trim();
      if (seen.has(key)) {
        setError(`Job number ${key} is entered more than once in this list.`);
        return;
      }
      seen.add(key);
    }

    setSaving(true);
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: insertedJobs, error: insertError } = await supabase
      .from("jobs")
      .insert(
        activeRows.map((row) => ({
          org_id: orgId,
          created_by: userId,
          client_name: row.client_name.trim(),
          job_number: row.job_number.trim(),
          trade_type: "Win",
          permit_tech: row.permit_tech,
          hoa_tech: row.hoa_tech === NONE ? "" : row.hoa_tech,
          stage: STAGES[0],
          sub_status: "Need to Submit",
          assigned_date: today,
        }))
      )
      .select();

    if (insertError || !insertedJobs) {
      setError(insertError?.message ?? "Could not create the jobs.");
      setSaving(false);
      return;
    }

    // Any row with an HOA tech also gets a linked hoa_jobs record, so the
    // same job number never has to be entered a second time on the HOA
    // Tracker side. Real HOA name/address gets filled in later from there;
    // this uses the same "Unassigned - Pending HOA Info" / TBD placeholder
    // already used for jobs whose HOA isn't known yet at intake time.
    const rowsNeedingHoa = activeRows.filter((row) => row.hoa_tech && row.hoa_tech !== NONE && row.hoa_tech !== NO_HOA_TECH);
    if (rowsNeedingHoa.length > 0) {
      const { data: placeholderHoa } = await supabase
        .from("hoas")
        .select("id")
        .eq("org_id", orgId)
        .ilike("name", PLACEHOLDER_HOA_NAME)
        .maybeSingle();

      const hoaId = placeholderHoa?.id
        ?? (
          await supabase
            .from("hoas")
            .insert({ org_id: orgId, name: PLACEHOLDER_HOA_NAME })
            .select("id")
            .single()
        ).data?.id;

      if (hoaId) {
        const hoaJobsPayload = rowsNeedingHoa
          .map((row) => {
            const job = insertedJobs.find((j) => j.job_number === row.job_number.trim());
            if (!job) return null;
            return {
              org_id: orgId,
              hoa_id: hoaId,
              job_id: job.id,
              job_number: row.job_number.trim(),
              job_name: row.client_name.trim(),
              address: "TBD",
              status: HOA_JOB_STATUSES[0],
              assigned_to: row.hoa_tech,
              assigned_date: today,
            };
          })
          .filter((payload): payload is NonNullable<typeof payload> => payload !== null);
        if (hoaJobsPayload.length > 0) {
          await supabase.from("hoa_jobs").insert(hoaJobsPayload);
        }
      }
    }

    setSaving(false);
    onCreated(insertedJobs);
    setRows(emptyRows());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-heading">Add {ROW_COUNT} jobs</DialogTitle>
            <DialogDescription>
              Quick intake for a batch of jobs — job number, client name, and tech only. Set an HOA tech on a row to also create the linked HOA job automatically, so it never has to be entered twice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-5">
            <div className="grid grid-cols-[1.3fr_2fr_1.6fr_1.6fr] gap-2 px-1 text-xs font-medium text-muted-foreground">
              <span>Job #</span>
              <span>Client Name</span>
              <span>Permit Tech</span>
              <span>HOA Tech (optional)</span>
            </div>
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1.3fr_2fr_1.6fr_1.6fr] gap-2">
                <Input
                  placeholder="Job #"
                  value={row.job_number}
                  onChange={(e) => updateRow(index, { job_number: e.target.value })}
                />
                <Input
                  placeholder="Client name"
                  value={row.client_name}
                  onChange={(e) => updateRow(index, { client_name: e.target.value })}
                />
                <Select value={row.permit_tech} onValueChange={(permit_tech) => updateRow(index, { permit_tech })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {permitTechs.map((tech) => <SelectItem key={tech} value={tech}>{tech}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={row.hoa_tech} onValueChange={(hoa_tech) => updateRow(index, { hoa_tech })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    <SelectItem value={NO_HOA_TECH}>{NO_HOA_TECH}</SelectItem>
                    {hoaTechs.map((tech) => <SelectItem key={tech} value={tech}>{tech}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : `Create jobs`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
