"use client";

import { useEffect, useState } from "react";
import type { Tables, TablesInsert } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { HOA_JOB_STATUSES } from "@/lib/hoa/constants";
import { useTechSlots, useTechLabel } from "@/components/tech-slots-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HoaCombobox, type HoaOption } from "./hoa-combobox";
import { HoaModal } from "./hoa-modal";

type HoaJob = Tables<"hoa_jobs">;

export function HoaJobModal({
  open,
  onOpenChange,
  orgId,
  hoas,
  hoaJob,
  defaultHoaId,
  linkedJobId,
  linkedJobNumber,
  defaultAddress,
  onSaved,
  onHoaCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  hoas: HoaOption[];
  hoaJob: HoaJob | null;
  defaultHoaId?: string | null;
  linkedJobId?: string | null;
  linkedJobNumber?: string | null;
  defaultAddress?: string;
  onSaved: (row: HoaJob) => void;
  onHoaCreated?: (hoa: Tables<"hoas">) => void;
}) {
  const { hoaTechs } = useTechSlots();
  const { hoaLabel } = useTechLabel();
  const initial = () => ({
    hoa_id: hoaJob?.hoa_id ?? defaultHoaId ?? null,
    job_number: hoaJob?.job_number ?? "",
    job_name: hoaJob?.job_name ?? "",
    address: hoaJob?.address ?? defaultAddress ?? "",
    status: hoaJob?.status ?? HOA_JOB_STATUSES[0],
    assigned_to: hoaJob?.assigned_to ?? "",
    assigned_date: hoaJob?.assigned_date ?? "",
    date_submitted: hoaJob?.date_submitted ?? "",
    date_approved: hoaJob?.date_approved ?? "",
    notes: hoaJob?.notes ?? "",
  });
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addHoaOpen, setAddHoaOpen] = useState(false);
  const [addHoaInitialName, setAddHoaInitialName] = useState("");

  // Re-sync the form whenever the dialog opens, so switching between "Add job"
  // for different HOAs (without unmounting this component) always shows the
  // correct defaults/values instead of stale state from a previous open.
  useEffect(() => {
    if (open) {
      setForm(initial());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hoaJob, defaultHoaId, defaultAddress]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hoa_id) return setError("Choose an HOA.");
    if (!form.address.trim()) return setError("Job address is required.");
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload: TablesInsert<"hoa_jobs"> = {
      org_id: orgId,
      hoa_id: form.hoa_id,
      job_id: hoaJob?.job_id ?? linkedJobId ?? null,
      job_number: form.job_number,
      job_name: form.job_name,
      address: form.address.trim(),
      status: form.status,
      assigned_to: form.assigned_to,
      assigned_date: form.assigned_date || null,
      date_submitted: form.date_submitted || null,
      date_approved: form.date_approved || null,
      notes: form.notes,
    };
    if (hoaJob) {
      const { data, error: err } = await supabase.from("hoa_jobs").update(payload).eq("id", hoaJob.id).select().single();
      setSaving(false);
      if (err || !data) return setError(err?.message ?? "Couldn't save that job.");
      onSaved(data);
    } else {
      const { data, error: err } = await supabase.from("hoa_jobs").insert(payload).select().single();
      setSaving(false);
      if (err || !data) return setError(err?.message ?? "Couldn't save that job.");
      onSaved(data);
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setForm(initial());
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle className="font-heading">{hoaJob ? "Edit HOA submission" : "New HOA submission"}</DialogTitle>
            <DialogDescription>
              {linkedJobNumber
                ? `Linked to Job #${linkedJobNumber}.`
                : "Track a property's HOA approval from submission to sign-off."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label>HOA / Community</Label>
              <HoaCombobox
                hoas={hoas}
                value={form.hoa_id}
                onChange={(id) => setForm({ ...form, hoa_id: id })}
                onCreateNew={(initialName) => {
                  setAddHoaInitialName(initialName);
                  setAddHoaOpen(true);
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hoajob-number">Job #</Label>
                <Input id="hoajob-number" placeholder="e.g. 2026-0142" value={form.job_number} onChange={(e) => setForm({ ...form, job_number: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoajob-name">Job name</Label>
                <Input id="hoajob-name" placeholder="e.g. Smith Residence" value={form.job_name} onChange={(e) => setForm({ ...form, job_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hoajob-address">Job address</Label>
              <Input id="hoajob-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Job status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOA_JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned to</Label>
                <Select value={form.assigned_to || "unassigned"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "unassigned" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {hoaTechs.map((t) => <SelectItem key={t} value={t}>{hoaLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <DateField label="Date assigned" value={form.assigned_date ?? null} onSave={(next) => setForm({ ...form, assigned_date: next ?? "" })} />
              </div>
              <div className="space-y-1.5">
                <DateField label="Date submitted" value={form.date_submitted ?? null} onSave={(next) => setForm({ ...form, date_submitted: next ?? "" })} />
              </div>
              <div className="space-y-1.5">
                <DateField label="Date approved" value={form.date_approved ?? null} onSave={(next) => setForm({ ...form, date_approved: next ?? "" })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hoajob-notes">Notes</Label>
              <Textarea id="hoajob-notes" rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <HoaModal
        open={addHoaOpen}
        onOpenChange={setAddHoaOpen}
        orgId={orgId}
        hoa={null}
        initialName={addHoaInitialName}
        onSaved={(created) => {
          setForm((f) => ({ ...f, hoa_id: created.id }));
          onHoaCreated?.(created);
          setAddHoaOpen(false);
        }}
      />
    </Dialog>
  );
}
