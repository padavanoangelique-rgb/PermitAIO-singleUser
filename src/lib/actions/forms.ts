"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { revalidatePath } from "next/cache";
import { listPdfFormFields, type DetectedPdfField } from "@/lib/forms/pdf-fill";
import type { ActionResult } from "./auth";

/**
 * Persists Address + Folio directly onto the job row so both the Permit
 * Application Info card and the Inventory row edit the same single source
 * of truth. Any downstream form fill (permit application, NOC, addendums)
 * reads from job.address / job.folio_number, so this update is enough to
 * make those PDFs pick the values up on the next generation.
 */
export async function updateJobSiteLocation(
  jobId: string,
  address: string | null,
  folioNumber: string | null,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      address: (address ?? "").trim() || null,
      folio_number: (folioNumber ?? "").trim() || null,
    })
    .eq("id", jobId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

export async function updateJobFolioJurisdiction(
  jobId: string,
  folioNumber: string,
  jurisdiction: string,
  browardTaxDistrictCode?: string, city?: string, address?: string, ): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const update: { folio_number: string | null; jurisdiction: string | null; city?: string | null; address?: string | null } = {
    folio_number: folioNumber.trim() || null,
    jurisdiction: jurisdiction.trim() || null,
  };
  if (city !== undefined) update.city = city.trim() || null; if (address !== undefined) update.address = address.trim() || null;
  const { error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", jobId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };

  // Broward jurisdiction is detected from a separate 4-digit tax district /
  // millage code (not the folio above), persisted on job_permit_details so
  // the Forms Generator and Permit Package Generator can both read it back.
  if (browardTaxDistrictCode !== undefined) {
    const { error: codeError } = await supabase.from("job_permit_details").upsert(
      {
        job_id: jobId,
        org_id: activeOrg.id,
        broward_tax_district_code: browardTaxDistrictCode.trim() || null,
      },
      { onConflict: "job_id" },
    );
    if (codeError) return { error: codeError.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

export interface UploadFormTemplateResult {
  error: string | null;
  fields: DetectedPdfField[];
}

export async function uploadFormTemplateFile(
  templateId: string,
  formData: FormData,
): Promise<UploadFormTemplateResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file first.", fields: [] };
  }
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    return { error: "Please upload a PDF file.", fields: [] };
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  let fields: DetectedPdfField[];
  try {
    fields = await listPdfFormFields(bytes);
  } catch {
    return { error: "Couldn't read that PDF. Make sure it isn't corrupted or password-protected.", fields: [] };
  }

  const base64 = Buffer.from(bytes).toString("base64");

  const { error } = await supabase
    .from("form_templates")
    .update({ file_name: file.name, file_data: base64, field_mapping: {} })
    .eq("id", templateId)
    .eq("org_id", activeOrg.id);

  if (error) return { error: error.message, fields: [] };

  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null, fields };
}

export async function saveFormTemplateMapping(
  templateId: string,
  mapping: Record<string, string>,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_templates")
    .update({ field_mapping: mapping })
    .eq("id", templateId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null };
}

export interface NewFormTemplateInput {
  county: string;
  jurisdictionCode: string | null;
  jurisdictionName: string | null;
  docType: string;
  title: string;
  description: string;
  trade: string;
}

export async function createFormTemplate(input: NewFormTemplateInput): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const title = input.title.trim();
  const county = input.county.trim();
  if (!title) return { error: "Give the form a title." };
  if (!county) return { error: "Choose a county." };

  // New forms sort after existing ones in the same county/jurisdiction
  // bucket so they don't jump ahead of the seeded base forms.
  const { data: siblings } = await supabase
    .from("form_templates")
    .select("sort_order")
    .eq("org_id", activeOrg.id)
    .eq("county", county)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder = (siblings?.[0]?.sort_order ?? 0) + 10;

  const { error } = await supabase.from("form_templates").insert({
    org_id: activeOrg.id,
    county,
    jurisdiction_code: input.jurisdictionCode,
    jurisdiction_name: input.jurisdictionName,
    doc_type: input.docType,
    title,
    description: input.description.trim(),
    trade: input.trade,
    sort_order: nextSortOrder,
  });
  if (error) return { error: error.message };
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null };
}

export interface FormTemplateDetailsInput {
  title: string;
  description: string;
  county: string;
  jurisdictionCode: string | null;
  jurisdictionName: string | null;
  trade: string;
}

export async function updateFormTemplateDetails(
  templateId: string,
  input: FormTemplateDetailsInput,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const title = input.title.trim();
  const county = input.county.trim();
  const trade = input.trade.trim() || "general";
  if (!title) return { error: "Give the form a title." };
  if (!county) return { error: "Choose a county." };

  const { error } = await supabase
    .from("form_templates")
    .update({
      title,
      description: input.description.trim(),
      county,
      jurisdiction_code: input.jurisdictionCode,
      jurisdiction_name: input.jurisdictionName,
      trade,
    })
    .eq("id", templateId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null };
}

export async function deleteFormTemplate(templateId: string): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_templates")
    .delete()
    .eq("id", templateId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null };
}

export async function removeFormTemplateFile(templateId: string): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_templates")
    .update({ file_name: null, file_data: null, field_mapping: {} })
    .eq("id", templateId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null };
}

export interface JobPermitDetailsInput {
  unit: string;
  legal_description: string;
  flood_zone: string;
  bfe: string;
  floor_area: string;
  building_use: string;
  construction_type: string;
  occupancy_group: string;
  present_use: string;
  proposed_use: string;
  description_of_work: string;
  work_type: string;
  work_type_other: string;
  owner_phone: string;
  owner_email: string;
  owner_builder: boolean;
  license_exempted: boolean;
  private_provider: boolean;
  owner_authorized_private_provider: boolean;
  architect_name: string;
  architect_phone: string;
  architect_email: string;
  architect_address: string;
  architect_city: string;
  architect_state: string;
  architect_zip: string;
  fee_simple_titleholder_name: string;
  fee_simple_city: string;
  fee_simple_state: string;
  fee_simple_zip: string;
  mortgage_lender_name: string;
  mortgage_lender_address: string;
  mortgage_city: string;
  mortgage_state: string;
  mortgage_zip: string;
}

export async function upsertJobPermitDetails(
  jobId: string,
  input: JobPermitDetailsInput,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const cleaned = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() || null : value,
    ]),
  );

  const { error } = await supabase
    .from("job_permit_details")
    .upsert(
      { job_id: jobId, org_id: activeOrg.id, ...cleaned },
      { onConflict: "job_id" },
    );
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}
