"use client";

import { useEffect, useState } from "react";
import type { Tables } from "@/lib/supabase/types";
import type { ParcelCountyKey } from "@/lib/parcel/lookup";
import { upsertJobPermitDetails, type JobPermitDetailsInput } from "@/lib/actions/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList } from "lucide-react";

type JobPermitDetails = Tables<"job_permit_details">;

const WORK_TYPES = ["Alteration", "Repair", "Replacement", "New", "Addition", "Revision", "Other"];
const BUILDING_USES = ["Single Family Residence", "Condominium"] as const;

// Counties whose public parcel layer exposes a legal-description field —
// see src/lib/parcel/lookup.ts. Miami-Dade's layer has none, so the pull
// button stays disabled there with an explanation rather than failing.
const LEGAL_DESCRIPTION_COUNTIES: ParcelCountyKey[] = ["broward", "palm-beach"];

function emptyDetails(): JobPermitDetailsInput {
  return {
    unit: "",
    legal_description: "",
    flood_zone: "N/A",
    bfe: "N/A",
    floor_area: "",
    building_use: "Single Family Residence",
    construction_type: "N/A",
    occupancy_group: "N/A",
    present_use: "Single Family Residence",
    proposed_use: "Single Family Residence",
    description_of_work: "Replace existing windows and/or doors with impact-resistant units.",
    work_type: "Alteration",
    work_type_other: "",
    owner_phone: "",
    owner_email: "",
    owner_builder: false,
    license_exempted: false,
    private_provider: false,
    owner_authorized_private_provider: false,
    architect_name: "",
    architect_phone: "",
    architect_email: "",
    architect_address: "",
    architect_city: "",
    architect_state: "",
    architect_zip: "",
    fee_simple_titleholder_name: "",
    fee_simple_city: "",
    fee_simple_state: "",
    fee_simple_zip: "",
    mortgage_lender_name: "",
    mortgage_lender_address: "",
    mortgage_city: "",
    mortgage_state: "",
    mortgage_zip: "",
  };
}

function fromRow(row: JobPermitDetails | null): JobPermitDetailsInput {
  const base = emptyDetails();
  if (!row) return base;
  const merged = { ...base };
  for (const key of Object.keys(base) as (keyof JobPermitDetailsInput)[]) {
    const value = row[key as keyof JobPermitDetails];
    if (typeof base[key] === "boolean") {
      (merged as Record<string, unknown>)[key] = Boolean(value);
    } else {
      const next = (value as string | null) ?? "";
      (merged as Record<string, unknown>)[key] = next || base[key];
    }
  }
  if (merged.building_use) {
    merged.present_use = merged.building_use;
    merged.proposed_use = merged.building_use;
  }
  merged.flood_zone = "N/A";
  merged.bfe = "N/A";
  merged.construction_type = "N/A";
  merged.occupancy_group = "N/A";
  return merged;
}

const compactControl = "h-8 text-sm";

export function PermitApplicationDetailsCard({
  jobId,
  initial,
  computedFloorAreaSqFt,
  countyKey,
  folioNumber,
  onSaved,
}: {
  jobId: string;
  initial: JobPermitDetails | null;
  computedFloorAreaSqFt?: number | null;
  /** The job's county, mapped to the parcel-lookup key — drives whether
   * "Pull from property appraiser" can run for legal description. */
  countyKey?: ParcelCountyKey | null;
  /** The job's folio / parcel control number, used as the lookup query. */
  folioNumber?: string | null;
  onSaved?: () => void;
}) {
  const [details, setDetails] = useState<JobPermitDetailsInput>(() => fromRow(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pullingLegal, setPullingLegal] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);

  useEffect(() => {
    setDetails(fromRow(initial));
  }, [initial]);

  function set<K extends keyof JobPermitDetailsInput>(key: K, value: JobPermitDetailsInput[K]) {
    setDetails((d) => {
      const next = { ...d, [key]: value };
      if (key === "building_use" && typeof value === "string") {
        next.present_use = value;
        next.proposed_use = value;
      }
      return next;
    });
  }

  const legalDescriptionAvailable = Boolean(countyKey && LEGAL_DESCRIPTION_COUNTIES.includes(countyKey));
  const trimmedFolio = (folioNumber ?? "").trim();

  async function pullLegalDescription() {
    if (!countyKey || !legalDescriptionAvailable || !trimmedFolio) return;
    setPullingLegal(true);
    setPullError(null);
    try {
      const cleaned = trimmedFolio.replace(/[^a-zA-Z0-9]/g, "");
      const res = await fetch(`/api/parcel-lookup?county=${countyKey}&q=${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok) {
        setPullError(data.error ?? "Lookup failed.");
        return;
      }
      const hit = (data.results ?? [])[0];
      if (!hit) {
        setPullError("No matching parcel found for that folio.");
        return;
      }
      if (!hit.legalDescription) {
        setPullError("That property record doesn't have a legal description on file.");
        return;
      }
      set("legal_description", hit.legalDescription);
    } catch {
      setPullError("Lookup failed.");
    } finally {
      setPullingLegal(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload: JobPermitDetailsInput = {
      ...details,
      flood_zone: "N/A",
      bfe: "N/A",
      construction_type: "N/A",
      occupancy_group: "N/A",
      present_use: details.building_use,
      proposed_use: details.building_use,
    };
    const res = await upsertJobPermitDetails(jobId, payload);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSavedAt(Date.now());
    onSaved?.();
  }

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-5 py-0">
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Permit Application Info
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Only the fields that change per job. Flood zone, BFE, construction type, occupancy, and present/proposed use are filled as N/A or copied from building use when the PDF is generated.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Unit / Suite">
            <Input className={compactControl} value={details.unit} onChange={(e) => set("unit", e.target.value)} placeholder="If any" />
          </Field>
          <Field label="Building use">
            <Select value={details.building_use || undefined} onValueChange={(v) => set("building_use", v)}>
              <SelectTrigger className={compactControl}><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {BUILDING_USES.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Work type">
            <Select value={details.work_type || undefined} onValueChange={(v) => set("work_type", v)}>
              <SelectTrigger className={compactControl}><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {WORK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Floor area (sq ft)">
            {typeof computedFloorAreaSqFt === "number" ? (
              <div className="flex h-8 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
                <span className="font-medium tabular-nums">{computedFloorAreaSqFt.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
                <span className="text-xs text-muted-foreground">from floor plan</span>
              </div>
            ) : (
              <Input className={compactControl} value={details.floor_area} onChange={(e) => set("floor_area", e.target.value)} placeholder="Auto from floor plan" />
            )}
          </Field>
          <Field label="Owner phone">
            <Input className={compactControl} value={details.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} type="tel" />
          </Field>
          <Field label="Owner email">
            <Input className={compactControl} value={details.owner_email} onChange={(e) => set("owner_email", e.target.value)} type="email" />
          </Field>
        </div>

        {details.work_type === "Other" && (
          <Field label="Work type — other">
            <Input className={compactControl} value={details.work_type_other} onChange={(e) => set("work_type_other", e.target.value)} />
          </Field>
        )}

        <Field label="Legal description">
          <div className="flex gap-2">
            <Input
              className={compactControl}
              value={details.legal_description}
              onChange={(e) => set("legal_description", e.target.value)}
              placeholder="Lot / block / subdivision — or leave blank if attached"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 px-2.5 text-xs"
              disabled={!legalDescriptionAvailable || !trimmedFolio || pullingLegal}
              onClick={() => void pullLegalDescription()}
              title={
                !legalDescriptionAvailable
                  ? "Not available from this county's public parcel data — Broward and Palm Beach only"
                  : !trimmedFolio
                    ? "Set the job's folio number first"
                    : undefined
              }
            >
              {pullingLegal ? "Pulling…" : "Pull from property appraiser"}
            </Button>
          </div>
          {pullError && <p className="text-xs text-destructive">{pullError}</p>}
          {!legalDescriptionAvailable && countyKey === "miami-dade" && (
            <p className="text-xs text-muted-foreground">
              Miami-Dade&rsquo;s public parcel data doesn&rsquo;t include legal description — type it in.
            </p>
          )}
        </Field>

        <Field label="Description of work">
          <Input className={compactControl} value={details.description_of_work} onChange={(e) => set("description_of_work", e.target.value)} />
        </Field>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="optional">
            <AccordionTrigger className="text-sm">Optional — architect, titleholder, lender</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Architect / engineer">
                  <Input className={compactControl} value={details.architect_name} onChange={(e) => set("architect_name", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input className={compactControl} value={details.architect_phone} onChange={(e) => set("architect_phone", e.target.value)} type="tel" />
                </Field>
                <Field label="Email">
                  <Input className={compactControl} value={details.architect_email} onChange={(e) => set("architect_email", e.target.value)} type="email" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Architect address" className="sm:col-span-2">
                  <Input className={compactControl} value={details.architect_address} onChange={(e) => set("architect_address", e.target.value)} />
                </Field>
                <Field label="City">
                  <Input className={compactControl} value={details.architect_city} onChange={(e) => set("architect_city", e.target.value)} />
                </Field>
                <Field label="State / Zip">
                  <div className="flex gap-2">
                    <Input className={compactControl} value={details.architect_state} onChange={(e) => set("architect_state", e.target.value)} placeholder="FL" />
                    <Input className={compactControl} value={details.architect_zip} onChange={(e) => set("architect_zip", e.target.value)} placeholder="Zip" />
                  </div>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fee simple titleholder">
                  <Input className={compactControl} value={details.fee_simple_titleholder_name} onChange={(e) => set("fee_simple_titleholder_name", e.target.value)} />
                </Field>
                <Field label="Mortgage lender">
                  <Input className={compactControl} value={details.mortgage_lender_name} onChange={(e) => set("mortgage_lender_name", e.target.value)} />
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex items-center gap-3 border-t pt-3">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && savedAt && <p className="text-sm text-muted-foreground">Saved.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
