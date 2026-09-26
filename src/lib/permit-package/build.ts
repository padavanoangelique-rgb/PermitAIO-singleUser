import JSZip from "jszip";
import { createClient } from "@/lib/supabase/client";
import { loadNoaLibraryEffective } from "@/lib/noa/load";
import type { Tables } from "@/lib/supabase/types";
import { detectMunicipalityCode, guessCountyFromText, normalizeFolioDigits, type FormCounty } from "@/lib/forms/folio";
import { matchFormTemplates, type FormTemplateRow } from "@/lib/forms/match";
import { codeForJurisdiction, resolveJurisdiction } from "@/lib/forms/jurisdictions";
import { fillPdfForm, base64ToBytes, type JobDataKey } from "@/lib/forms/pdf-fill";
import {
  groupScheduleByProduct,
  matchNoaLibrary,
  matchMullions,
  mullionNoaIssues,
  matchRoofingComponents,
  type FloorPlanMullion,
  type NoaLibraryRow,
  type RoofingComponent,
} from "@/lib/noa/match";
import { buildBrowardSchedulePdf, buildSchedulePdf, type ScheduleWindowRow } from "./schedule-pdf";
import { captureFloorPlanPdf } from "./floor-plan-capture";
import { isRoofingTrade, normalizeTradeFamily, ROOFING_COMPONENT_TYPE_LABELS } from "@/lib/jobs/trade";
import { loadFenestrationChart } from "./fenestration";
import { buildPermitChecklistPdf, computeWindowTotals, countWindowsAndDoors, groupOpeningsByNoa } from "./checklist-pdf";

type Job = Tables<"jobs">;
type ContractorProfile = Tables<"contractor_profiles">;
type JobFile = Tables<"job_files">;

export interface PackageManifest {
  version: number;
  generated_at: string;
  job_number: string;
  client_name: string;
  floor_plan: { included: boolean; note: string };
  schedule: { included: boolean; opening_count: number; mullion_count: number };
  forms: { county: string | null; included: string[]; missing: string[] };
  noas: { matched_count: number; missing_count: number; included: string[] };
  supporting_docs: { count: number; files: string[] };
  fenestration_chart: { included: boolean; file_name: string | null };
  permit_checklist: { included: boolean };
}

export interface PackageBuildResult {
  zip: Blob;
  manifest: PackageManifest;
}

function toRowFormTemplate(t: Tables<"form_templates">): FormTemplateRow {
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

function safeName(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_");
}

async function uniqueZipName(zip: JSZip, folder: string, name: string): Promise<string> {
  let candidate = name;
  let n = 1;
  while (zip.file(`${folder}/${candidate}`)) {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    candidate = `${base}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

export async function buildPermitPackage(job: Job, version: number): Promise<PackageBuildResult> {
  const supabase = createClient();
  const isRoofing = isRoofingTrade(job.trade_type);

  const [
    sessionRes,
    planRes,
    templatesRes,
    contractorsRes,
    noaLibrary,
    jobFilesRes,
    permitDetailsRes,
    roofingDetailsRes,
    roofingComponentsRes,
    annRes,
  ] = await Promise.all([
    supabase.auth.getSession(),
    isRoofing
      ? Promise.resolve({ data: null })
      : supabase
          .from("floor_plans")
          .select("plan_data")
          .eq("job_id", job.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
    // Forms are platform-shared: every org sees the same library, so we
    // filter by visibility rather than org_id. Admin edits happen on the
    // /admin/forms page — see src/app/admin/forms.
    supabase.from("form_templates").select("*").eq("visibility", "platform"),
    supabase.from("contractor_profiles").select("*").eq("org_id", job.org_id),
    // Platform + this-org rows, with per-org pressure overrides merged in.
    loadNoaLibraryEffective(supabase),
    supabase
      .from("job_files")
      .select("*")
      .eq("org_id", job.org_id)
      .eq("job_id", job.id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("job_permit_details")
      .select("*")
      .eq("job_id", job.id)
      .maybeSingle(),
    isRoofing
      ? supabase.from("job_roofing_details").select("*").eq("job_id", job.id).maybeSingle()
      : Promise.resolve({ data: null }),
    isRoofing
      ? supabase
          .from("job_roofing_components")
          .select("*")
          .eq("job_id", job.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: null }),
    supabase.from("job_noa_annotations").select("noa_library_id, storage_path").eq("job_id", job.id),
  ]);

  const planData = (planRes.data?.plan_data ?? {}) as {
    windows?: ScheduleWindowRow[];
    mullions?: FloorPlanMullion[];
    scheduleJurisdiction?: string;
  };
  const windows: ScheduleWindowRow[] = planData.windows ?? [];
  const mullions: FloorPlanMullion[] = planData.mullions ?? [];
  const annotationMap = new Map<string, string>();
  for (const r of annRes.data ?? []) annotationMap.set(r.noa_library_id, r.storage_path);
  // The user picks which county schedule to ship from the header dropdown
  // in the floor plan (Broward / Palm Beach / Miami-Dade / Martin / Boca
  // Raton / Indian River). Falls back to the job's saved jurisdiction and
  // then Broward.
  const scheduleJurisdictionKey: string =
    planData.scheduleJurisdiction ??
    (guessCountyFromText(job.jurisdiction) === "Miami-Dade"
      ? "miami"
      : guessCountyFromText(job.jurisdiction) === "Palm Beach"
        ? "pbc"
        : "schedule");
  const jobFiles: JobFile[] = jobFilesRes.data ?? [];
  const roofingDetails = roofingDetailsRes.data as Tables<"job_roofing_details"> | null;
  const roofingComponents = (roofingComponentsRes.data ?? []) as RoofingComponent[];

  const zip = new JSZip();
  const root = `${job.job_number} Permit Package v${version}`;

  // ---------- 1. Floor plan ----------
  let floorPlanIncluded = false;
  let floorPlanNote = "No floor plan on file for this job yet.";
  if (isRoofing) {
    floorPlanNote = "Not applicable — roofing jobs use the Roofing Details tab instead of a floor plan.";
  } else if (windows.length > 0 || mullions.length > 0) {
    const session = sessionRes.data.session;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (session?.access_token && supabaseUrl && supabaseAnonKey) {
      const pdfBytes = await captureFloorPlanPdf({
        supabaseUrl,
        supabaseAnonKey,
        accessToken: session.access_token,
        orgId: job.org_id,
        jobId: job.id,
      });
      if (pdfBytes) {
        // Floor Plan PDF lives at the top level of the ZIP so it's one
        // click away — no more diving into a "01 Floor Plan" subfolder.
        // Prefix keeps it sorted above Forms ("02") and the schedule.
        zip.file(`${root}/01 Floor Plan.pdf`, pdfBytes);
        floorPlanIncluded = true;
        floorPlanNote = "Captured from the Floor Plans tab.";
      } else {
        floorPlanNote =
          "Couldn't capture the Floor Plan PDF automatically — download it from the Floor Plans tab and add it manually.";
      }
    } else {
      floorPlanNote = "Couldn't capture the Floor Plan PDF automatically (no active session).";
    }
  }
  if (!floorPlanIncluded) {
    // Fallback note stays at ZIP root too so it's obviously visible when
    // the floor plan couldn't be captured.
    zip.file(`${root}/01 Floor Plan - MISSING.txt`, floorPlanNote);
  }

  // ---------- 2. Forms ----------
  // The jurisdiction set on the Permit Inventory tab is the source of truth
  // for which forms apply. Resolve it to a canonical (county, city) first;
  // if that fails, fall back to guessing the county from the free-text
  // field (older jobs may still have county-only jurisdictions like
  // "Broward County"). Folio-based detection is used only as a last resort
  // when the jurisdiction field is empty or unrecognized — no more
  // "go set your folio in the Forms Generator tab" round trip.
  const resolved = resolveJurisdiction(job.jurisdiction);
  const county: FormCounty | null =
    resolved?.county ?? guessCountyFromText(job.jurisdiction);
  const permitDetails = permitDetailsRes.data;
  const includedForms: string[] = [];
  const missingForms: string[] = [];

  // First choice for the city-level code: the jurisdiction the user picked
  // on the Permit Inventory tab, mapped through the platform's form_templates
  // list. Templates loaded below double as a name→code index.
  const templates = (templatesRes.data ?? []).map(toRowFormTemplate);
  let effectiveCode: string | null = null;
  if (county && resolved?.city) {
    effectiveCode = codeForJurisdiction(county, resolved.city, templates);
  }

  // Legacy fallback — if the jurisdiction didn't resolve to a city with its
  // own form template, try to derive the code from folio number / Broward
  // tax district. This keeps older jobs (folio filled in, jurisdiction left
  // as "Broward County") working without a data migration.
  if (county && !effectiveCode) {
    const browardTaxDistrictCode = permitDetails?.broward_tax_district_code ?? null;
    const folioDigits = normalizeFolioDigits(job.folio_number);
    const browardCodeForDetection =
      normalizeFolioDigits(browardTaxDistrictCode).length > 0
        ? browardTaxDistrictCode
        : folioDigits.length > 0 && folioDigits.length <= 4
          ? job.folio_number
          : browardTaxDistrictCode;
    const detection = detectMunicipalityCode(
      county,
      county === "Broward" ? browardCodeForDetection : job.folio_number,
    );
    effectiveCode = detection.ok ? detection.code : null;
  }
  if (county) {
    // Prefer the resolved city (canonical) over raw job.jurisdiction so the
    // matcher can pick up city-specific templates whose jurisdiction_code is
    // null (Miramar / Pembroke Pines / Plantation / Coral Springs / etc.).
    const jurisdictionForMatch = resolved?.city ?? job.jurisdiction;
    const matched = matchFormTemplates(
      templates,
      county,
      effectiveCode,
      job.trade_type,
      jurisdictionForMatch,
    );
    const allForms = [...matched.base, ...matched.specific];

    // Loud diagnostic when the org has no form templates for this county —
    // otherwise the ZIP silently ships with no 02 Forms/ folder and no
    // note about why, which is exactly the bug that produced the empty
    // permit package. Also stamp a note file at 02 Forms/ so the missing
    // forms are visible to whoever opens the ZIP.
    if (allForms.length === 0) {
      const trade = (job.trade_type ?? "").trim() || "(no trade set)";
      const codeNote = effectiveCode ? ` (jurisdiction code: ${effectiveCode})` : "";
      missingForms.push(
        `No form templates on file for ${county}${codeNote} / trade "${trade}". Upload the county application, NOC, and any city addenda under Settings → Form Templates.`,
      );
      zip.file(
        `${root}/02 Forms/README - no forms.txt`,
        [
          `No form templates matched this job.`,
          ``,
          `County: ${county}`,
          `Jurisdiction code: ${effectiveCode ?? "(none — no city-specific code detected)"}`,
          `Trade: ${trade}`,
          `Templates in library: ${templates.length}`,
          ``,
          `To fix: open Settings → Form Templates and upload the ${county} building`,
          `permit application, Notice of Commencement, and any city-specific addenda`,
          `(e.g. Miami-Dade Product Approval / 1802). Then rebuild this permit package.`,
        ].join("\n"),
      );
    }

    const contractors: ContractorProfile[] = contractorsRes.data ?? [];
    const jobFamily = isRoofing ? "roofing" : "windows";
    const byTrade = contractors.find((c) => c.trade === jobFamily && c.is_default);
    const anyDefault = contractors.find((c) => c.is_default);
    const contractor = byTrade ?? anyDefault ?? contractors.find((c) => c.trade === jobFamily) ?? contractors[0] ?? null;

    const d = permitDetails;
    const values: Partial<Record<JobDataKey, string>> = {
      job_number: job.job_number,
      client_name: job.client_name,
      job_address: job.address ?? "",
      job_unit: d?.unit ?? "",
      job_city: job.city ?? "",
      folio_number: job.folio_number ?? "",
      jurisdiction: job.jurisdiction ?? county,
      permit_number: job.permit_number ?? "",
      job_value: job.contract_value != null ? String(job.contract_value) : "",
      today_date: new Date().toLocaleDateString("en-US"),

      owner_phone: d?.owner_phone ?? "",
      owner_email: d?.owner_email ?? "",

      legal_description: d?.legal_description ?? "",
      // These four building-department questions never vary on our jobs
      // (window/door installs on existing structures) so we hard-fill "N/A"
      // rather than making the user type it on every job. Kept in the DB
      // schema for future flexibility, but never surfaced in the UI.
      flood_zone: "N/A",
      bfe: "N/A",
      construction_type: "N/A",
      occupancy_group: "N/A",
      // Floor area comes from the floor plan (Σ width×height / 144). Falls
      // back to the manual value if no windows are on the plan yet.
      floor_area: (() => {
        if (!isRoofing && windows.length > 0) {
          const { totalSqFt } = computeWindowTotals(windows);
          return totalSqFt > 0 ? String(totalSqFt) : (d?.floor_area ?? "");
        }
        return d?.floor_area ?? "";
      })(),
      building_use: d?.building_use ?? "",
      // Present Use and Proposed Use always mirror Building Use on our jobs
      // — we're not changing the use of the building, we're installing
      // windows/doors. Auto-mirroring keeps three fields in one input.
      present_use: d?.building_use ?? "",
      proposed_use: d?.building_use ?? "",
      description_of_work: ((): string => {
        if (normalizeTradeFamily(job.trade_type) === "windows" && windows.length > 0) {
          const { windowCount, doorCount } = countWindowsAndDoors(windows);
          return `Replace ${windowCount} windows and ${doorCount} doors Like for Like with Impact`;
        }
        return d?.description_of_work ?? "";
      })(),
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

    // DEBUG: dump the exact values object being sent into fillPdfForm, plus
    // per-form fill diagnostics, so we can see whether the client is passing
    // empty strings/mappings or whether individual field writes are failing.
    // TODO(angelique): remove once the blank-fill bug is confirmed fixed.
    const fillDiagnosticsByForm: Record<string, unknown> = {};
    const debugPayload = {
      note: "This file shows what values were passed to fillPdfForm. Empty strings = missing data. See fill_diagnostics for what actually happened per PDF field.",
      built_at: new Date().toISOString(),
      county,
      effectiveCode,
      job_id: job.id,
      job_number: job.job_number,
      job_client_name_direct: job.client_name,
      job_address_direct: job.address,
      contractors_query_returned: contractorsRes.data?.length ?? 0,
      contractor_found: contractor !== null,
      contractor_id: contractor?.id ?? null,
      contractor_company: contractor?.company_name ?? null,
      permit_details_found: permitDetails !== null,
      forms_matched: allForms.length,
      forms_titles: allForms.map((f) => f.title),
      forms_mapping_counts: allForms.map((f) => ({
        title: f.title,
        field_mapping_keys: Object.keys(f.field_mapping ?? {}).length,
      })),
      values,
      fill_diagnostics: fillDiagnosticsByForm,
    };

    for (const row of allForms) {
      if (!row.file_data) {
        missingForms.push(`${row.title} (no template PDF uploaded)`);
        continue;
      }
      try {
        const bytes = base64ToBytes(row.file_data);
        const { bytes: filled, diagnostics } = await fillPdfForm(bytes, row.field_mapping ?? {}, values);
        fillDiagnosticsByForm[row.title] = diagnostics;
        const name = await uniqueZipName(zip, `${root}/02 Forms`, safeName(`${row.title}.pdf`));
        zip.file(`${root}/02 Forms/${name}`, filled);
        includedForms.push(row.title);
      } catch (err) {
        // Include the error message so we can see WHY it couldn't fill.
        const msg = err instanceof Error ? err.message : String(err);
        missingForms.push(`${row.title} (couldn't fill this template: ${msg})`);
      }
    }

    // Written after the fill loop so fill_diagnostics is populated.
    zip.file(`${root}/DEBUG_READ_ME.json`, JSON.stringify(debugPayload, null, 2));
  } else {
    missingForms.push("No jurisdiction detected — set the job's jurisdiction on the Permit Inventory tab first.");
  }

  // ---------- 3. Window/door schedule or Roofing Details ----------
  let scheduleLabel: string;
  if (isRoofing) {
    scheduleLabel = "Roofing Details";
    const lines = [
      `Roofing Details — ${job.job_number} (${job.client_name})`,
      "",
      `Roof covering type: ${roofingDetails?.roof_covering_type ?? "not set"}`,
      `Roof shape: ${roofingDetails?.roof_shape ?? "not set"}`,
      `Mean roof height: ${roofingDetails?.mean_roof_height ?? "not set"}`,
      roofingDetails?.notes ? `Notes: ${roofingDetails.notes}` : "",
      "",
      "Materials:",
      ...(roofingComponents.length === 0
        ? [" (none entered yet)"]
        : roofingComponents.map(
            (c) =>
              ` - ${ROOFING_COMPONENT_TYPE_LABELS[c.component_type] ?? c.component_type}: ${
                c.manufacturer || "(no manufacturer)"
              } ${c.product ? `— ${c.product}` : ""}`.trim(),
          )),
    ]
      .filter((l) => l !== "")
      .join("\n");
    zip.file(`${root}/03 Roofing Details/Roofing Details.txt`, lines);
  } else {
    // Map the header picker choice → human-readable county name printed at
    // the top of the schedule PDF. All six counties currently reuse the
    // Broward BORA template (only Broward's is on disk today); the header
    // just gets re-branded per the user's earlier direction. Martin, Boca,
    // and Indian River will get their real templates when uploaded and
    // this map is the single place to swap them in.
    const jurisdictionMeta: Record<string, { label: string; heading: string }> = {
      schedule: { label: "Broward County", heading: "Broward County" },
      pbc: { label: "Palm Beach County", heading: "Palm Beach County" },
      miami: { label: "Miami-Dade County", heading: "Miami-Dade County" },
      martin: { label: "Martin County", heading: "Martin County" },
      boca: { label: "Boca Raton", heading: "Boca Raton" },
      irc: { label: "Indian River County", heading: "Indian River County" },
    };
    const meta = jurisdictionMeta[scheduleJurisdictionKey] ?? jurisdictionMeta.schedule;
    scheduleLabel = `${meta.label} Window-Door Schedule`;

    // All six counties reuse the Broward template today (only Broward's
    // form asset is on disk). buildBrowardSchedulePdf accepts a heading
    // override so the printed county name at the top matches the picker.
    const templateBytes = await buildBrowardSchedulePdf(
      job.client_name,
      job.address ?? "",
      windows,
      { heading: meta.heading },
    );
    const scheduleBytes =
      templateBytes ??
      (await buildSchedulePdf(job.job_number, job.client_name, windows, mullions, (noaLibrary ?? []) as NoaLibraryRow[]));
    // Window/Door Schedule PDF also lives at the top level of the ZIP so
    // it's one click away — no extra step of opening a subfolder just to
    // grab the PDF. Filename includes the county so it's obvious.
    zip.file(`${root}/03 ${meta.label} Window-Door Schedule.pdf`, scheduleBytes);
  }

  // ---------- 4. NOAs ----------
  const library: NoaLibraryRow[] = (noaLibrary ?? []) as NoaLibraryRow[];
  const matchedFiles = new Map<string, NoaLibraryRow>();
  let missingNoaCount = 0;
  if (isRoofing) {
    const roofingMatches = matchRoofingComponents(roofingComponents, library);
    for (const c of roofingMatches) {
      const best = c.matches.find((m) => m.storage_path);
      if (best) matchedFiles.set(best.id, best);
      else missingNoaCount += 1;
    }
  } else {
    const groups = matchNoaLibrary(groupScheduleByProduct(windows), library);
    const mullionGroups = matchMullions(mullions, library);
    for (const g of groups) {
      const best = g.matches.find((m) => m.storage_path);
      if (best) matchedFiles.set(best.id, best);
      else missingNoaCount += 1;
    }
    for (const m of mullionGroups) {
      const best = m.matches.find((mm) => mm.storage_path);
      if (best) matchedFiles.set(best.id, best);
      else missingNoaCount += 1;
    }
  }
  // NOA PDFs drop at the ZIP root as individual files, not inside a
  // subfolder. Each one is renamed to Manufacturer_Model_NOA-####.pdf so a
  // reviewer can identify the product from the filename alone. Per
  // Angelique: "one file in the zip folder as individual attachments not
  // in another folder that has to be emptied into the main folder."
  const includedNoas: string[] = [];
  const failedNoas: string[] = [];
  for (const row of matchedFiles.values()) {
        const annotatedPath = annotationMap.get(row.id);
        const bucket = annotatedPath ? "job-noa-annotations" : "noa-library";
        const path = annotatedPath ?? row.storage_path;
        if (!path) {
                failedNoas.push(`${row.manufacturer} ${row.series ?? ""} ${row.noa_number} (no PDF uploaded to noa-library)`);
                continue;
        }
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (error || !data) {
      failedNoas.push(`${row.manufacturer} ${row.series ?? ""} ${row.noa_number} (storage error: ${error?.message ?? "no signed URL"})`);
      continue;
    }
    try {
      const res = await fetch(data.signedUrl);
      if (!res.ok) {
        failedNoas.push(`${row.manufacturer} ${row.series ?? ""} ${row.noa_number} (fetch ${res.status})`);
        continue;
      }
      const blob = await res.blob();
      const parts = [row.manufacturer, row.model_number || row.series, row.noa_number]
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .join(" ");
      const baseName = `${parts || row.manufacturer || row.noa_number || "NOA"}.pdf`;
      const name = await uniqueZipName(zip, root, safeName(baseName));
      zip.file(`${root}/${name}`, blob);
      includedNoas.push(name);
    } catch (err) {
      failedNoas.push(
        `${row.manufacturer} ${row.series ?? ""} ${row.noa_number} (${err instanceof Error ? err.message : "unknown error"})`,
      );
    }
  }

  // Loud diagnostic when we matched NOAs but couldn't actually attach
  // any of them (network / storage / permission failures used to fail
  // silently — that's why the empty ZIP looked like "no NOAs matched"
  // even when the library was correctly linked).
  if (matchedFiles.size > 0 && includedNoas.length === 0) {
    zip.file(
      `${root}/NOAs - MISSING.txt`,
      [
        `${matchedFiles.size} NOA(s) matched this job but none could be attached to the ZIP.`,
        ``,
        `Failed downloads:`,
        ...failedNoas.map((f) => ` - ${f}`),
        ``,
        `Common causes: NOA library row has no file uploaded, storage bucket`,
        `permissions blocking signed URLs, or expired session. Try re-uploading`,
        `the NOA PDFs from the NOA Library tab and rebuild.`,
      ].join("\n"),
    );
  }

  // ---------- 4b. Fenestration chart ----------
  // County-specific single-page wind-load chart. Same jurisdiction key as
  // the schedule so the two agree on which county the packet is for.
  let fenestrationIncluded = false;
  let fenestrationFileName: string | null = null;
  if (!isRoofing) {
    const chart = await loadFenestrationChart(scheduleJurisdictionKey);
    if (chart) {
      const name = await uniqueZipName(zip, root, safeName(chart.fileName));
      zip.file(`${root}/${name}`, chart.bytes);
      fenestrationIncluded = true;
      fenestrationFileName = name;
    }
  }

  // ---------- 4c. Permit Checklist ----------
  // One-page PDF that lists every submittal item as a checkbox plus every
  // NOA and each opening it applies to. Ships at the ZIP root so the field
  // team can print it as the packet cover sheet.
  let checklistIncluded = false;
  if (!isRoofing) {
    try {
      const { groups, unmatched } = groupOpeningsByNoa(windows, library);
      const { totalOpenings, totalSqFt } = computeWindowTotals(windows);
      const checklistBytes = await buildPermitChecklistPdf({
        jobNumber: job.job_number,
        clientName: job.client_name,
        address: job.address ?? "",
        countyLabel: scheduleLabel.replace(/ Window-Door Schedule$/, ""),
        fenestrationChartName: fenestrationFileName,
        scheduleFileName: `${scheduleLabel}.pdf`,
        noaGroups: groups,
        unmatchedOpeningCount: unmatched,
        totalOpenings,
        totalSqFt,
      });
      const name = await uniqueZipName(zip, root, "00 Permit Checklist.pdf");
      zip.file(`${root}/${name}`, checklistBytes);
      checklistIncluded = true;
    } catch (err) {
      console.error("Failed to build permit checklist PDF", err);
    }
  }

  // ---------- 5. Supporting documents ----------
  const includedDocs: string[] = [];
  for (const file of jobFiles) {
    const { data, error } = await supabase.storage.from("job-files").createSignedUrl(file.storage_path, 300);
    if (error || !data) continue;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    const name = await uniqueZipName(zip, `${root}/05 Supporting Documents`, safeName(file.file_name));
    zip.file(`${root}/05 Supporting Documents/${name}`, blob);
    includedDocs.push(file.file_name);
  }

  const manifest: PackageManifest = {
    version,
    generated_at: new Date().toISOString(),
    job_number: job.job_number,
    client_name: job.client_name,
    floor_plan: { included: floorPlanIncluded, note: floorPlanNote },
    schedule: {
      included: true,
      opening_count: isRoofing ? roofingComponents.length : windows.length,
      mullion_count: isRoofing ? 0 : mullions.length,
    },
    forms: { county, included: includedForms, missing: missingForms },
    noas: { matched_count: includedNoas.length, missing_count: missingNoaCount, included: includedNoas },
    supporting_docs: { count: includedDocs.length, files: includedDocs },
    fenestration_chart: { included: fenestrationIncluded, file_name: fenestrationFileName },
    permit_checklist: { included: checklistIncluded },
  };

  zip.file(
    `${root}/README.txt`,
    [
      `Permit Package — ${job.job_number} (${job.client_name})`,
      `Version ${version} — generated ${new Date().toLocaleString("en-US")}`,
      "",
      `Floor plan: ${floorPlanIncluded ? "included" : "not included — " + floorPlanNote}`,
      isRoofing
        ? `${scheduleLabel}: ${roofingComponents.length} material(s) entered`
        : `${scheduleLabel}: ${windows.length} opening(s), ${mullions.length} mullion(s)`,
      `Forms: ${includedForms.length} included${missingForms.length ? `, ${missingForms.length} missing` : ""}`,
      missingForms.length ? missingForms.map((m) => ` - ${m}`).join("\n") : "",
      `NOAs: ${includedNoas.length} matched and included${missingNoaCount ? `, ${missingNoaCount} opening group(s) with no NOA on file` : ""}`,
      ...(isRoofing || mullions.length === 0
        ? []
        : (() => {
            const issues = mullionNoaIssues(mullions, library);
            return [
              issues.missing.length ? `WARNING: mullion(s) with no NOA selected: ${issues.missing.join(", ")}` : "",
              issues.expired.length ? `WARNING: mullion NOA expired: ${issues.expired.join(", ")}` : "",
            ];
          })()),
      `Fenestration chart: ${fenestrationIncluded ? fenestrationFileName : "not on file for this county yet"}`,
      `Permit checklist: ${checklistIncluded ? "included" : "not generated"}`,
      `Supporting documents: ${includedDocs.length} included`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return { zip: zipBlob, manifest };
}
