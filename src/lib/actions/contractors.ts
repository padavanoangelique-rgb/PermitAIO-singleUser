"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";

function contractorFieldsFromForm(formData: FormData) {
  return {
    company_name: String(formData.get("company_name") ?? "").trim(),
    trade: String(formData.get("trade") ?? "windows"),
    license_number: String(formData.get("license_number") ?? "").trim() || null,
    contact_name: String(formData.get("contact_name") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    state: String(formData.get("state") ?? "").trim() || null,
    zip: String(formData.get("zip") ?? "").trim() || null,
    qualifier_name: String(formData.get("qualifier_name") ?? "").trim() || null,
    business_tax_receipt_number:
      String(formData.get("business_tax_receipt_number") ?? "").trim() || null,
    bonding_company: String(formData.get("bonding_company") ?? "").trim() || null,
    bonding_address: String(formData.get("bonding_address") ?? "").trim() || null,
    bonding_city: String(formData.get("bonding_city") ?? "").trim() || null,
    bonding_state: String(formData.get("bonding_state") ?? "").trim() || null,
    bonding_zip: String(formData.get("bonding_zip") ?? "").trim() || null,
    is_default: formData.get("is_default") === "on",
    license_expires: String(formData.get("license_expires") ?? "").trim() || null,
    insurance_expires: String(formData.get("insurance_expires") ?? "").trim() || null,
    workers_comp_expires: String(formData.get("workers_comp_expires") ?? "").trim() || null,
    btr_expires: String(formData.get("btr_expires") ?? "").trim() || null,
  };
}

export async function createContractorProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const fields = contractorFieldsFromForm(formData);

  if (!fields.company_name) {
    return { error: "Company name is required." };
  }

  if (fields.is_default) {
    await supabase
      .from("contractor_profiles")
      .update({ is_default: false })
      .eq("org_id", activeOrg.id)
      .eq("trade", fields.trade);
  }

  const { error } = await supabase.from("contractor_profiles").insert({
    org_id: activeOrg.id,
    ...fields,
  } as never);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/contractors");
  return { error: null };
}

export async function updateContractorProfile(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const fields = contractorFieldsFromForm(formData);

  if (!fields.company_name) {
    return { error: "Company name is required." };
  }

  if (fields.is_default) {
    await supabase
      .from("contractor_profiles")
      .update({ is_default: false })
      .eq("org_id", activeOrg.id)
      .eq("trade", fields.trade)
      .neq("id", id);
  }

  const { error } = await supabase
    .from("contractor_profiles")
    .update(fields as never)
    .eq("id", id)
    .eq("org_id", activeOrg.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/contractors");
  return { error: null };
}

export async function deleteContractorProfile(id: string) {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  await supabase
    .from("contractor_profiles")
    .delete()
    .eq("id", id)
    .eq("org_id", activeOrg.id);
  revalidatePath("/contractors");
}
