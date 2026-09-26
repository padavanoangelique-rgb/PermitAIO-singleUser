"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveOrg } from "@/lib/data/orgs";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";
import type { PackageManifest } from "@/lib/permit-package/build";
import type { Tables } from "@/lib/supabase/types";

export type SavePermitPackageResult = ActionResult & { id?: string };

const PACKAGE_BUCKET_LIMIT_BYTES = 68157440; // 65 MB

/** Raises the permit-packages Storage cap so a matched-NOA ZIP can save on the job. */
export async function raisePermitPackageCap(): Promise<ActionResult> {
  await requireActiveOrg();
  const admin = createAdminClient();
  const { error } = await admin.storage.updateBucket("permit-packages", {
    fileSizeLimit: PACKAGE_BUCKET_LIMIT_BYTES,
    public: false,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function savePermitPackage(input: {
  jobId: string;
  version: number;
  storagePath: string;
  manifest: PackageManifest;
}): Promise<SavePermitPackageResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("permit_packages")
    .insert({
      org_id: activeOrg.id,
      job_id: input.jobId,
      version: input.version,
      storage_path: input.storagePath,
      manifest: input.manifest as never,
      generated_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/jobs/${input.jobId}`);
  return { error: null, id: data.id };
}

export async function markPermitPackageStatus(
  packageId: string,
  jobId: string,
  status: "reviewed" | "submitted",
  reviewNotes: string,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const update: Partial<Tables<"permit_packages">> = { status, review_notes: reviewNotes.trim() || null };
  if (status === "reviewed") {
    update.reviewed_by = userData.user?.id ?? null;
    update.reviewed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("permit_packages")
    .update(update)
    .eq("id", packageId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

export async function deletePermitPackage(packageId: string, jobId: string): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const { data: pkg, error: fetchError } = await supabase
    .from("permit_packages")
    .select("storage_path")
    .eq("id", packageId)
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  if (fetchError || !pkg) return { error: "That package no longer exists." };

  const { error: deleteError } = await supabase
    .from("permit_packages")
    .delete()
    .eq("id", packageId)
    .eq("org_id", activeOrg.id);
  if (deleteError) return { error: deleteError.message };

  if (pkg.storage_path) {
    await supabase.storage.from("permit-packages").remove([pkg.storage_path]);
  }

  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}
