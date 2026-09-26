"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";

export interface JobRoofingDetailsInput {
  roof_covering_type: string;
  roof_shape: string;
  mean_roof_height: string;
  notes: string;
}

export async function upsertJobRoofingDetails(
  jobId: string,
  input: JobRoofingDetailsInput,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const cleaned = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value.trim() || null]),
  );

  const { error } = await supabase
    .from("job_roofing_details")
    .upsert({ job_id: jobId, org_id: activeOrg.id, ...cleaned }, { onConflict: "job_id" });
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

export interface RoofingComponentInput {
  id?: string;
  component_type: string;
  manufacturer: string;
  product: string;
  noa_number_hint: string;
  sort_order: number;
}

/**
 * Replaces every roofing component row for this job with the given list.
 * Simpler and safer than diffing individual inserts/updates/deletes since
 * the panel always edits the full set at once.
 */
export async function saveJobRoofingComponents(
  jobId: string,
  components: RoofingComponentInput[],
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("job_roofing_components")
    .delete()
    .eq("job_id", jobId)
    .eq("org_id", activeOrg.id);
  if (deleteError) return { error: deleteError.message };

  const rows = components
    .filter((c) => c.manufacturer.trim() || c.product.trim() || c.noa_number_hint.trim())
    .map((c, i) => ({
      job_id: jobId,
      org_id: activeOrg.id,
      component_type: c.component_type,
      manufacturer: c.manufacturer.trim() || null,
      product: c.product.trim() || null,
      noa_number_hint: c.noa_number_hint.trim() || null,
      sort_order: i,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("job_roofing_components").insert(rows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}
