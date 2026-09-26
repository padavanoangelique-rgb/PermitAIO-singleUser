"use server";

/**
 * Server actions for managing the platform-shared `form_templates`
 * library — the one every org sees via `visibility='platform'` RLS.
 * Every write goes through `createAdminClient()` (service role) and is
 * gated by `requirePlatformAdmin()` so only Angelique / other platform
 * admins can edit these rows.
 */

import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { FormCounty } from "@/lib/forms/folio";
import type { Database } from "@/lib/supabase/types";
import { listPdfFormFields, base64ToBytes, type DetectedPdfField } from "@/lib/forms/pdf-fill";
import { ensureHeaderMapping } from "@/lib/forms/guess-mapping";

type FormTemplateUpdate = Database["public"]["Tables"]["form_templates"]["Update"];

export interface PlatformFormResult {
  error: string | null;
  id?: string;
}

export interface UploadPlatformFormInput {
  county: FormCounty;
  jurisdictionName: string | null;
  jurisdictionCode: string | null;
  docType: string;
  title: string;
  description: string | null;
  fileName: string;
  fileDataBase64: string;
  trade: string;
  sortOrder: number;
}

export async function uploadPlatformForm(
  input: UploadPlatformFormInput,
): Promise<PlatformFormResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  if (!input.title.trim()) return { error: "Title is required." };
  if (!input.fileDataBase64) return { error: "File is required." };

  const { data, error } = await admin
    .from("form_templates")
    .insert({
      org_id: null,
      visibility: "platform",
      county: input.county,
      jurisdiction_name: input.jurisdictionName?.trim() || null,
      jurisdiction_code: input.jurisdictionCode?.trim() || null,
      doc_type: input.docType,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      file_name: input.fileName,
      file_data: input.fileDataBase64,
      trade: input.trade || "general",
      sort_order: input.sortOrder,
      field_mapping: {},
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/forms");
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null, id: data?.id };
}

export interface UpdatePlatformFormInput {
  id: string;
  title?: string;
  description?: string | null;
  docType?: string;
  trade?: string;
  jurisdictionName?: string | null;
  jurisdictionCode?: string | null;
  county?: FormCounty;
  sortOrder?: number;
  fileName?: string;
  fileDataBase64?: string;
}

export async function updatePlatformForm(
  input: UpdatePlatformFormInput,
): Promise<PlatformFormResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const patch: FormTemplateUpdate = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.docType !== undefined) patch.doc_type = input.docType;
  if (input.trade !== undefined) patch.trade = input.trade || "general";
  if (input.jurisdictionName !== undefined)
    patch.jurisdiction_name = input.jurisdictionName?.trim() || null;
  if (input.jurisdictionCode !== undefined)
    patch.jurisdiction_code = input.jurisdictionCode?.trim() || null;
  if (input.county !== undefined) patch.county = input.county;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.fileName !== undefined) patch.file_name = input.fileName;
  if (input.fileDataBase64 !== undefined) patch.file_data = input.fileDataBase64;

  const { error } = await admin
    .from("form_templates")
    .update(patch)
    .eq("id", input.id)
    .eq("visibility", "platform");

  if (error) return { error: error.message };
  revalidatePath("/admin/forms");
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null, id: input.id };
}

export async function deletePlatformForm(id: string): Promise<PlatformFormResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("form_templates")
    .delete()
    .eq("id", id)
    .eq("visibility", "platform");

  if (error) return { error: error.message };
  revalidatePath("/admin/forms");
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null, id };
}

export async function listPlatformFormFields(id: string): Promise<{
  error: string | null;
  fields: DetectedPdfField[];
  mapping: Record<string, string>;
}> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("form_templates")
    .select("file_data, field_mapping")
    .eq("id", id)
    .eq("visibility", "platform")
    .maybeSingle();

  if (error) return { error: error.message, fields: [], mapping: {} };
  if (!data?.file_data) return { error: "No PDF on this form.", fields: [], mapping: {} };

  try {
    const fields = await listPdfFormFields(base64ToBytes(data.file_data));
    const stored = (data.field_mapping as Record<string, string>) ?? {};
    const mapping = ensureHeaderMapping(
      fields.map((f) => f.name),
      stored,
    );
    return { error: null, fields, mapping };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not read PDF fields (encrypted or flattened).",
      fields: [],
      mapping: {},
    };
  }
}

export async function savePlatformFormMapping(
  id: string,
  mapping: Record<string, string>,
): Promise<PlatformFormResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const cleaned = Object.fromEntries(
    Object.entries(mapping).filter(([, v]) => typeof v === "string" && v.trim()),
  );
  const { error } = await admin
    .from("form_templates")
    .update({ field_mapping: cleaned })
    .eq("id", id)
    .eq("visibility", "platform");
  if (error) return { error: error.message };
  revalidatePath("/admin/forms");
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null, id };
}

export async function remapAllPlatformFormHeaders(): Promise<{
  error: string | null;
  updated: number;
  skipped: number;
  flattened: number;
}> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("form_templates")
    .select("id, title, file_data, field_mapping")
    .eq("visibility", "platform");
  if (error) return { error: error.message, updated: 0, skipped: 0, flattened: 0 };

  let updated = 0;
  let skipped = 0;
  let flattened = 0;

  for (const row of data ?? []) {
    if (!row.file_data) {
      skipped += 1;
      continue;
    }
    const fields = await listPdfFormFields(base64ToBytes(row.file_data));
    if (fields.length === 0) {
      flattened += 1;
      continue;
    }
    const stored = (row.field_mapping as Record<string, string>) ?? {};
    const next = ensureHeaderMapping(
      fields.map((f) => f.name),
      stored,
    );
    const same =
      Object.keys(next).length === Object.keys(stored).length &&
      Object.entries(next).every(([k, v]) => stored[k] === v);
    if (same) {
      skipped += 1;
      continue;
    }
    const { error: writeError } = await admin
      .from("form_templates")
      .update({ field_mapping: next })
      .eq("id", row.id)
      .eq("visibility", "platform");
    if (writeError) return { error: writeError.message, updated, skipped, flattened };
    updated += 1;
  }

  revalidatePath("/admin/forms");
  revalidatePath("/forms-library");
  revalidatePath("/libraries");
  return { error: null, updated, skipped, flattened };
}
