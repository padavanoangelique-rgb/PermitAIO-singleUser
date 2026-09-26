"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";
import {
  detectMunicipalityCode,
  guessCountyFromText,
  type FormCounty,
} from "@/lib/forms/folio";
import type { ParcelCountyKey } from "@/lib/parcel/lookup";
import { matchFormTemplates, DOC_TYPE_LABELS, type FormTemplateRow } from "@/lib/forms/match";
import { fillPdfForm, base64ToBytes, downloadBytes, type JobDataKey } from "@/lib/forms/pdf-fill";
import { computeWindowTotals } from "@/lib/permit-package/checklist-pdf";
import { isRoofingTrade } from "@/lib/jobs/trade";
import { PermitApplicationDetailsCard } from "./permit-application-details-card"; import { ParcelLookupCard } from "./parcel-lookup-card";
import { PanelSkeleton } from "@/components/ui/loading-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Package } from "lucide-react";

type Job = Tables<"jobs">;
type FormTemplateDb = Tables<"form_templates">;
type ContractorProfile = Tables<"contractor_profiles">;
type FolioCode = Tables<"folio_jurisdiction_codes">;
type JobPermitDetails = Tables<"job_permit_details">;

// Only these three counties have a live parcel-lookup adapter (see
// src/lib/parcel/lookup.ts) — Martin and St. Lucie forms exist but have
// no property-appraiser data source wired up yet.
const FORM_COUNTY_TO_PARCEL_KEY: Partial<Record<FormCounty, ParcelCountyKey>> = {
  "Miami-Dade": "miami-dade",
  Broward: "broward",
  "Palm Beach": "palm-beach",
};

function toRow(t: FormTemplateDb): FormTemplateRow {
  return {
    id: t.id,
    county: t.county,
    jurisdiction_code: t.jurisdiction_code,
    jurisdiction_name: t.jurisdiction_name,
    doc_type: t.doc_type,
    title: t.title,
    description: t.description,
    file_name: t.file_name,
    file_data: t.file_data,
    field_mapping: (t.field_mapping as Record<string, string>) ?? {},
    sort_order: t.sort_order,
    trade: t.trade,
  };
}

export function JobFormsPanel({ job }: { job: Job }) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<FormTemplateDb[]>([]);
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [folioCodes, setFolioCodes] = useState<FolioCode[]>([]);
  const [permitDetails, setPermitDetails] = useState<JobPermitDetails | null>(null);
  const [floorPlanSqFt, setFloorPlanSqFt] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [packing, setPacking] = useState(false);

  const county = useMemo<FormCounty | null>(
    () => guessCountyFromText(job.jurisdiction),
    [job.jurisdiction],
  );
  const parcelCountyKey = useMemo<ParcelCountyKey | null>(
    () => (county ? FORM_COUNTY_TO_PARCEL_KEY[county] ?? null : null),
    [county],
  );
  const folioInput = job.folio_number ?? "";
  const inventoryJurisdictionName = useMemo(() => {
    const raw = (job.jurisdiction ?? "").split(",")[0].trim();
    if (!raw || /county$/i.test(raw)) return null;
    return raw;
  }, [job.jurisdiction]);
  const cityInput = job.city ?? inventoryJurisdictionName ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [templatesRes, contractorsRes, codesRes, permitDetailsRes, floorPlanRes] = await Promise.all([
      supabase.from("form_templates").select("*").eq("visibility", "platform"),
      supabase.from("contractor_profiles").select("*").eq("org_id", job.org_id),
      supabase.from("folio_jurisdiction_codes").select("*"),
      supabase.from("job_permit_details").select("*").eq("job_id", job.id).maybeSingle(),
      supabase
        .from("floor_plans")
        .select("plan_data")
        .eq("job_id", job.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setTemplates(templatesRes.data ?? []);
    setContractors(contractorsRes.data ?? []);
    setFolioCodes(codesRes.data ?? []);
    setPermitDetails(permitDetailsRes.data ?? null);
    const planData = (floorPlanRes.data?.plan_data ?? {}) as {
      windows?: { width?: number | string | null; height?: number | string | null }[];
    };
    const windowsList = planData.windows ?? [];
    if (windowsList.length > 0) {
      setFloorPlanSqFt(computeWindowTotals(windowsList).totalSqFt);
    } else {
      setFloorPlanSqFt(null);
    }
    setLoading(false);
  }, [job.org_id, job.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const detection = useMemo(() => {
    if (!county) return null;
    const browardCode = permitDetails?.broward_tax_district_code ?? "";
    return detectMunicipalityCode(county, county === "Broward" ? browardCode : folioInput);
  }, [county, folioInput, permitDetails?.broward_tax_district_code]);

  const jurisdictionCode = useMemo(() => {
    if (!county || !inventoryJurisdictionName) return null;
    const match = folioCodes.find(
      (c) =>
        c.county === county &&
        (c.jurisdiction_name ?? "").trim().toLowerCase() === inventoryJurisdictionName.toLowerCase(),
    );
    return match?.code ?? null;
  }, [county, inventoryJurisdictionName, folioCodes]);

  const effectiveCode = jurisdictionCode ?? (detection?.ok ? detection.code : null);
  const city = inventoryJurisdictionName;

  const pack = useMemo(() => {
    if (!county) return [];
    const matched = matchFormTemplates(
      templates.map(toRow),
      county,
      effectiveCode,
      job.trade_type,
      inventoryJurisdictionName,
    );
    return [...matched.base, ...matched.specific];
  }, [templates, county, effectiveCode, job.trade_type, inventoryJurisdictionName]);

  const packLabel = city && county ? `${city}, ${county}` : county ?? "This job";

  function defaultContractor(): ContractorProfile | null {
    if (contractors.length === 0) return null;
    const jobFamily = isRoofingTrade(job.trade_type) ? "roofing" : "windows";
    return (
      contractors.find((c) => c.trade === jobFamily && c.is_default) ??
      contractors.find((c) => c.is_default) ??
      contractors.find((c) => c.trade === jobFamily) ??
      contractors[0]
    );
  }

  function values(): Partial<Record<JobDataKey, string>> {
    const contractor = defaultContractor();
    const d = permitDetails;
    return {
      job_number: job.job_number,
      client_name: job.client_name,
      job_address: job.address ?? "",
      job_unit: d?.unit ?? "",
      job_city: cityInput,
      folio_number: folioInput,
      jurisdiction: job.jurisdiction ?? county ?? "",
      permit_number: job.permit_number ?? "",
      job_value: job.contract_value != null ? String(job.contract_value) : "",
      today_date: new Date().toLocaleDateString("en-US"),
      owner_phone: d?.owner_phone ?? "",
      owner_email: d?.owner_email ?? "",
      legal_description: d?.legal_description ?? "",
      flood_zone: "N/A",
      bfe: "N/A",
      construction_type: "N/A",
      occupancy_group: "N/A",
      floor_area:
        typeof floorPlanSqFt === "number" && floorPlanSqFt > 0 ? String(floorPlanSqFt) : d?.floor_area ?? "",
      building_use: d?.building_use ?? "",
      present_use: d?.building_use ?? "",
      proposed_use: d?.building_use ?? "",
      description_of_work: d?.description_of_work ?? "",
      work_type: d?.work_type === "Other" ? d?.work_type_other ?? "" : d?.work_type ?? "",
      contractor_company: contractor?.company_name ?? "",
      contractor_phone: contractor?.phone ?? "",
      contractor_email: contractor?.email ?? "",
      contractor_address: contractor?.address ?? "",
      contractor_city: contractor?.city ?? "",
      contractor_state: contractor?.state ?? "",
      contractor_zip: contractor?.zip ?? "",
      contractor_license: contractor?.license_number ?? "",
      qualifier_name: contractor?.qualifier_name ?? "",
      business_tax_receipt_number: contractor?.business_tax_receipt_number ?? "",
      bonding_company: contractor?.bonding_company ?? "",
      bonding_address: contractor?.bonding_address ?? "",
      bonding_city: contractor?.bonding_city ?? "",
      bonding_state: contractor?.bonding_state ?? "",
      bonding_zip: contractor?.bonding_zip ?? "",
      architect_name: d?.architect_name ?? "",
      architect_phone: d?.architect_phone ?? "",
      architect_email: d?.architect_email ?? "",
      architect_address: d?.architect_address ?? "",
      architect_city: d?.architect_city ?? "",
      architect_state: d?.architect_state ?? "",
      architect_zip: d?.architect_zip ?? "",
      fee_simple_titleholder_name: d?.fee_simple_titleholder_name ?? "",
      fee_simple_city: d?.fee_simple_city ?? "",
      fee_simple_state: d?.fee_simple_state ?? "",
      fee_simple_zip: d?.fee_simple_zip ?? "",
      mortgage_lender_name: d?.mortgage_lender_name ?? "",
      mortgage_lender_address: d?.mortgage_lender_address ?? "",
      mortgage_city: d?.mortgage_city ?? "",
      mortgage_state: d?.mortgage_state ?? "",
      mortgage_zip: d?.mortgage_zip ?? "",
    };
  }

  async function fillRow(row: FormTemplateRow) {
    if (!row.file_data) throw new Error("No PDF uploaded");
    const { bytes } = await fillPdfForm(base64ToBytes(row.file_data), row.field_mapping ?? {}, values());
    return bytes;
  }

  async function handleGenerate(row: FormTemplateRow) {
    setGeneratingId(row.id);
    try {
      const bytes = await fillRow(row);
      downloadBytes(bytes, `${job.job_number} - ${row.title}.pdf`);
    } catch (e) {
      alert(`Couldn't generate that form: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleFillPack() {
    const ready = pack.filter((r) => r.file_data);
    if (ready.length === 0) return;
    setPacking(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`${job.job_number} ${packLabel} forms`);
      if (!folder) throw new Error("Could not create pack");
      let i = 1;
      for (const row of ready) {
        const bytes = await fillRow(row);
        const n = String(i).padStart(2, "0");
        folder.file(`${n} ${row.title}.pdf`, bytes);
        i += 1;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.job_number} ${packLabel} forms.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Couldn't build the pack: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setPacking(false);
    }
  }

  if (loading) return <PanelSkeleton cards={2} />;

  return (
    <div className="space-y-4"> <ParcelLookupCard job={job} onApplied={() => void load()} /> <PermitApplicationDetailsCard
        jobId={job.id}
        initial={permitDetails}
        computedFloorAreaSqFt={floorPlanSqFt}
        countyKey={parcelCountyKey}
        folioNumber={folioInput}
        onSaved={() => void load()}
      />

      <Card className="gap-2 py-4">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-5 py-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <Package className="h-4 w-4 text-muted-foreground" />
              {packLabel} pack
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {city
                ? `County application + NOC plus every ${city} page, filled together.`
                : "Set the city on the job to attach city pages on top of the county forms."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={packing || pack.filter((r) => r.file_data).length === 0}
            onClick={() => void handleFillPack()}
          >
            {packing ? "Building pack…" : "Fill entire pack"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 px-5">
          {!county && (
            <p className="text-sm text-muted-foreground">Pick a jurisdiction on the job first.</p>
          )}
          {county && pack.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No forms in this pack yet. Upload the county app, then the {city ?? "city"} pages.
            </p>
          )}
          {pack.map((row, index) => {
            const hasFile = Boolean(row.file_data);
            const mapped = Object.keys(row.field_mapping ?? {}).length;
            const cityForm = Boolean(row.jurisdiction_name || row.jurisdiction_code);
            return (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm font-medium">{row.title}</p>
                    <Badge variant="outline" className="text-xs">
                      {cityForm ? city ?? "City" : "County"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {DOC_TYPE_LABELS[row.doc_type] ?? row.doc_type}
                    </Badge>
                  </div>
                  <p className="mt-0.5 pl-8 text-xs text-muted-foreground">
                    {!hasFile ? "PDF not uploaded" : mapped === 0 ? "Uploaded — map fields next" : `${mapped} fields mapped`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {hasFile && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadBytes(base64ToBytes(row.file_data!), row.file_name ?? `${row.title}.pdf`)}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Blank
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!hasFile || generatingId === row.id}
                    onClick={() => void handleGenerate(row)}
                  >
                    {generatingId === row.id ? "Filling…" : "Fill one"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
