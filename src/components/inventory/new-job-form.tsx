"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { COUNTIES, STAGES, canonicalJurisdiction, jurisdictionsInCounty, type SubStatus } from "@/lib/inventory/constants";
import { useTechSlots } from "@/components/tech-slots-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ParcelSearch } from "@/components/inventory/parcel-search";
import type { ParcelHit } from "@/lib/parcel/lookup";

type Job = Tables<"jobs">;

export function NewJobForm({
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
  /** Retained for backwards compatibility, not used — County drives the jurisdiction list. */
  jurisdictionOptions?: string[];
  onCreated: (job: Job) => void;
}) {
  const { permitTechs } = useTechSlots();
  const [form, setForm] = useState({
    client_name: "", job_number: "", trade_type: "Win", contract_value: "", permit_number: "",
    address: "", folio_number: "",
    county: "", jurisdiction: "", stage: STAGES[0], sub_status: "Need to Submit" as SubStatus, permit_tech: permitTechs[0],
    broward_millage: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyParcel(hit: ParcelHit) {
    const cities = jurisdictionsInCounty(hit.countyLabel);
    const rawCity = (hit.city || "").trim();
    // The county record leaves the city blank (or says "Unincorporated ...") for
    // parcels outside any city's limits — the county's own building department is
    // the permitting authority there, so default straight to the county instead of
    // leaving Jurisdiction unset and forcing a manual "pick a city" every time.
    const cityMatch =
      !rawCity || /unincorporated/i.test(rawCity)
        ? hit.countyLabel
        : (cities.find((j) => j.toLowerCase() === rawCity.toLowerCase()) ??
          cities.find((j) => j.toLowerCase().includes(rawCity.toLowerCase())) ??
          "");
    setForm((prev) => ({
      ...prev,
      county: hit.countyLabel,
      address: hit.address || prev.address,
      folio_number: hit.folio || prev.folio_number,
      jurisdiction: cityMatch || prev.jurisdiction,
      client_name: prev.client_name || hit.owner,
      broward_millage: hit.millageCode || prev.broward_millage,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase.from("jobs").insert({
      org_id: orgId,
      created_by: userId,
      client_name: form.client_name,
      job_number: form.job_number,
      trade_type: form.trade_type,
      contract_value: form.contract_value ? Number(form.contract_value) : null,
      permit_number: form.permit_number || null,
      address: form.address || null,
      folio_number: form.folio_number || null,
      jurisdiction: form.jurisdiction ? canonicalJurisdiction(form.jurisdiction) : null,
      city: form.jurisdiction ? canonicalJurisdiction(form.jurisdiction) : null,
      stage: form.stage,
      sub_status: form.sub_status,
      permit_tech: form.permit_tech,
      assigned_date: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create the job.");
      setSaving(false);
      return;
    }
    if (form.broward_millage) {
      await supabase.from("job_permit_details").upsert(
        {
          job_id: data.id,
          org_id: orgId,
          broward_tax_district_code: form.broward_millage,
        },
        { onConflict: "job_id" },
      );
    }
    setSaving(false);
    onCreated(data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-heading">Add permit inventory job</DialogTitle>
            <DialogDescription>Look up the property first. Address, folio, owner, and city fill from the county record. Broward city comes from millage, not the folio prefix.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5 md:grid-cols-3">
            <Field label="County">
              <Select value={form.county} onValueChange={(county) => setForm({ ...form, county, jurisdiction: county })}>
                <SelectTrigger><SelectValue placeholder="Pick county…" /></SelectTrigger>
                <SelectContent>{COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <ParcelSearch countyLabel={form.county} onPick={applyParcel} />
            <Field label="Client Name"><Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></Field>
            <Field label="Job Number"><Input required value={form.job_number} onChange={(e) => setForm({ ...form, job_number: e.target.value })} /></Field>
            <Field label="Permit Number"><Input value={form.permit_number} onChange={(e) => setForm({ ...form, permit_number: e.target.value })} /></Field>
            <Field label="Job Address"><Input placeholder="Street, unit…" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Folio Number"><Input placeholder="Property folio / parcel" value={form.folio_number} onChange={(e) => setForm({ ...form, folio_number: e.target.value })} /></Field>
            <Field label="Jurisdiction">
              <Select value={form.jurisdiction} onValueChange={(jurisdiction) => setForm({ ...form, jurisdiction })} disabled={!form.county}>
                <SelectTrigger><SelectValue placeholder={form.county ? "Pick building department…" : "Pick county first"} /></SelectTrigger>
                <SelectContent>
                  {jurisdictionsInCounty(form.county).map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {form.county === "Broward County" && (
              <Field label="Broward millage">
                <Input value={form.broward_millage} onChange={(e) => setForm({ ...form, broward_millage: e.target.value })} placeholder="4-digit tax district" />
              </Field>
            )}
            <Field label="Product">
              <Select value={form.trade_type} onValueChange={(trade_type) => setForm({ ...form, trade_type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                {["Win", "Windows", "Tile", "Metal", "Shingle", "Roof"].map((trade) => <SelectItem key={trade} value={trade}>{trade}</SelectItem>)}
              </SelectContent></Select>
            </Field>
            <Field label="Contract Value"><Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} /></Field>
            <Field label="Job Status"><Select value={form.stage} onValueChange={(stage) => setForm({ ...form, stage })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Permit Tech"><Select value={form.permit_tech} onValueChange={(permit_tech) => setForm({ ...form, permit_tech })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{permitTechs.map((tech) => <SelectItem key={tech} value={tech}>{tech}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Job"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
