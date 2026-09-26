"use client";

import { useEffect, useState } from "react";
import type { Tables, TablesInsert } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Hoa = Tables<"hoas">;

export function HoaModal({
  open,
  onOpenChange,
  orgId,
  hoa,
  onSaved,
  initialName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  hoa: Hoa | null;
  onSaved: (hoa: Hoa) => void;
  initialName?: string;
}) {
  const [form, setForm] = useState({
    name: hoa?.name ?? initialName ?? "",
    mgmt_co: hoa?.mgmt_co ?? "",
    contact_name: hoa?.contact_name ?? "",
    phone: hoa?.phone ?? "",
    email: hoa?.email ?? "",
    address: hoa?.address ?? "",
    qualifications: hoa?.qualifications ?? "",
    notes: hoa?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the form whenever the dialog opens, so switching between "New HOA"
  // and "Edit <different HOA>" (without unmounting this component) always shows
  // the correct values instead of stale state from a previous open.
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hoa, initialName]);

  function reset() {
    setForm({
      name: hoa?.name ?? initialName ?? "",
      mgmt_co: hoa?.mgmt_co ?? "",
      contact_name: hoa?.contact_name ?? "",
      phone: hoa?.phone ?? "",
      email: hoa?.email ?? "",
      address: hoa?.address ?? "",
      qualifications: hoa?.qualifications ?? "",
      notes: hoa?.notes ?? "",
    });
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("HOA name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload: TablesInsert<"hoas"> = { org_id: orgId, ...form, name: form.name.trim() };
    if (hoa) {
      const { data, error: err } = await supabase.from("hoas").update(payload).eq("id", hoa.id).select().single();
      setSaving(false);
      if (err || !data) return setError(err?.message ?? "Couldn't save that HOA.");
      onSaved(data);
    } else {
      const { data, error: err } = await supabase.from("hoas").insert(payload).select().single();
      setSaving(false);
      if (err || !data) return setError(err?.message ?? "Couldn't save that HOA.");
      onSaved(data);
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle className="font-heading">{hoa ? "Edit HOA" : "New HOA"}</DialogTitle>
            <DialogDescription>
              {hoa ? "Update this community's details." : "Add a new HOA / community to your directory."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="hoa-name">HOA / Community name</Label>
              <Input id="hoa-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hoa-mgmt">Management company</Label>
                <Input id="hoa-mgmt" value={form.mgmt_co} onChange={(e) => setForm({ ...form, mgmt_co: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoa-contact">Contact name</Label>
                <Input id="hoa-contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoa-phone">Phone</Label>
                <Input id="hoa-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoa-email">Email</Label>
                <Input id="hoa-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hoa-address">Address</Label>
              <Input id="hoa-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hoa-qualifications">Qualifications / submittal requirements</Label>
              <Textarea id="hoa-qualifications" rows={3} value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hoa-notes">Notes</Label>
              <Textarea id="hoa-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
    </Dialog>
  );
}
