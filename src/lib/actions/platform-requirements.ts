"use server";

import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";

type RequirementsFormsInsert = Database["public"]["Tables"]["requirements_forms"]["Insert"];
type RequirementsFormsUpdate = Database["public"]["Tables"]["requirements_forms"]["Update"];

export interface PlatformRequirementInput {
  county: string;
  jurisdiction: string;
  title: string;
  docType: string;
  trade: string;
  notes: string;
}

export interface PlatformRequirementResult {
  error: string | null;
}

function normalize(input: PlatformRequirementInput) {
  return {
    county: input.county.trim() || null,
    jurisdiction: input.jurisdiction.trim(),
    title: input.title.trim(),
    doc_type: input.docType.trim() || "other",
    trade: input.trade.trim() || "windows_doors",
    notes: input.notes.trim() || null,
  };
}

function revalidateAll() {
  revalidatePath("/admin/requirements");
  revalidatePath("/requirements-forms");
}

/**
 * Add a new platform-scoped row to requirements_forms. Only platform
 * admins may call this (enforced both here and by RLS).
 *
 * We use createAdminClient() rather than the normal RLS-scoped server
 * client for a boring practical reason: RLS lets platform admins insert
 * platform rows fine, but the admin client sidesteps any org-membership
 * assumptions and matches the pattern the other /admin server actions
 * already use.
 */
export async function createPlatformRequirement(
  input: PlatformRequirementInput,
): Promise<PlatformRequirementResult> {
  await requirePlatformAdmin();
  const n = normalize(input);
  if (!n.jurisdiction) return { error: "Enter a jurisdiction." };
  if (!n.title) return { error: "Enter a title." };

  const admin = createAdminClient();
  const row: RequirementsFormsInsert = {
    ...n,
    visibility: "platform",
    owner_org_id: null,
    org_id: null,
  };
  const { error } = await admin.from("requirements_forms").insert(row);
  if (error) return { error: error.message };
  revalidateAll();
  return { error: null };
}

export async function updatePlatformRequirement(
  id: number,
  input: PlatformRequirementInput,
): Promise<PlatformRequirementResult> {
  await requirePlatformAdmin();
  const n = normalize(input);
  if (!n.jurisdiction) return { error: "Enter a jurisdiction." };
  if (!n.title) return { error: "Enter a title." };

  const admin = createAdminClient();
  const patch: RequirementsFormsUpdate = n;
  const { error } = await admin
    .from("requirements_forms")
    .update(patch)
    .eq("id", id)
    .eq("visibility", "platform");
  if (error) return { error: error.message };
  revalidateAll();
  return { error: null };
}

export async function deletePlatformRequirement(id: number): Promise<PlatformRequirementResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("requirements_forms")
    .delete()
    .eq("id", id)
    .eq("visibility", "platform");
  if (error) return { error: error.message };
  revalidateAll();
  return { error: null };
}
