"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";

export interface NoaEntryInput {
  manufacturer: string;
  windowType: string;
  series: string;
  modelNumber: string;
  noaNumber: string;
  trade: string;
  pressurePos: string;
  pressureNeg: string;
  effectiveDate: string | null;
  expirationDate: string | null;
  notes: string;
  /**
   * "platform" — visible to every org (only platform admins may write).
   * "org" — visible only to the creating org (org members may write).
   * Defaults to "org" when omitted; the platform value is ignored for
   * non-admin callers (silently downgraded to "org").
   */
  visibility?: "platform" | "org";
}

/**
 * Manufacturer name aliases -> canonical form. Whenever a NOA row is written
 * we run the manufacturer through this map so that "CWS" and "Custom Window
 * Systems" collapse to the same entry, "ES Windows" and "E.S." collapse to the
 * same entry, etc. Keeping this on the write path (instead of only in a one-off
 * SQL migration) means new uploads stay tidy without a follow-up cleanup pass.
 */
const MANUFACTURER_ALIASES: Record<string, string> = {
  cws: "Custom Window Systems, Inc.",
  "custom window systems": "Custom Window Systems, Inc.",
  "custom window systems inc": "Custom Window Systems, Inc.",
  "custom window systems, inc": "Custom Window Systems, Inc.",
  "custom window systems, inc.": "Custom Window Systems, Inc.",
  es: "E.S. Windows, Inc.",
  "e.s.": "E.S. Windows, Inc.",
  "e.s. windows": "E.S. Windows, Inc.",
  "e.s. windows inc": "E.S. Windows, Inc.",
  "e.s. windows, inc": "E.S. Windows, Inc.",
  "e.s. windows, inc.": "E.S. Windows, Inc.",
  "es windows": "E.S. Windows, Inc.",
  "es windows inc": "E.S. Windows, Inc.",
};

function canonicalManufacturer(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const key = trimmed.toLowerCase();
  return MANUFACTURER_ALIASES[key] ?? trimmed;
}

function parsePressure(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeInput(input: NoaEntryInput) {
  return {
    manufacturer: canonicalManufacturer(input.manufacturer),
    window_type: input.windowType.trim() || null,
    series: input.series.trim() || null,
    model_number: input.modelNumber.trim() || null,
    noa_number: input.noaNumber.trim(),
    trade: input.trade.trim() || "windows",
    pressure_pos: parsePressure(input.pressurePos),
    pressure_neg: parsePressure(input.pressureNeg),
    effective_date: input.effectiveDate || null,
    expiration_date: input.expirationDate || null,
    notes: input.notes.trim() || null,
  };
}

// Postgres error code for unique_violation. Our unique indexes:
//   - platform_unique  on (manufacturer, series, noa_number) where visibility='platform'
//   - org_unique       on (owner_org_id, manufacturer, series, noa_number) where visibility='org'
const PG_UNIQUE_VIOLATION = "23505";

// ─── Create ────────────────────────────────────────────────────────────────

export async function createNoaEntry(input: NoaEntryInput): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const normalized = normalizeInput(input);
  if (!normalized.manufacturer) return { error: "Give the NOA a manufacturer." };
  if (!normalized.noa_number) return { error: "Enter the NOA / FL# number." };

  const isAdmin = await isPlatformAdmin();
  // Only platform admins can create platform rows; anyone else silently
  // gets an org row (visibility flag from a non-admin form is ignored).
  const wantsPlatform = input.visibility === "platform" && isAdmin;
  const visibility = wantsPlatform ? "platform" : "org";
  const ownerOrgId = wantsPlatform ? null : activeOrg.id;

  const { error } = await supabase.from("noa_library").insert({
    // Legacy column kept for backwards-compatibility with older rows;
    // scoping is now driven by visibility + owner_org_id.
    org_id: activeOrg.id,
    created_by: userData.user?.id ?? null,
    visibility,
    owner_org_id: ownerOrgId,
    ...normalized,
  });
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      const scope = wantsPlatform ? "the platform library" : "your library";
      return {
        error: `${scope} already has an NOA/FL# for ${normalized.manufacturer} ${normalized.series || ""} ${normalized.noa_number}. Edit the existing entry instead of adding a duplicate.`,
      };
    }
    return { error: error.message };
  }
  revalidatePath("/noa-library");
  revalidatePath("/libraries");
  revalidatePath("/admin/noa");
  return { error: null };
}

// ─── Update ────────────────────────────────────────────────────────────────

/**
 * Update a NOA row. RLS is the enforcer — platform admins can update
 * platform rows, org members can update their own org's rows. Any other
 * combination fails at the database.
 */
export async function updateNoaEntry(entryId: string, input: NoaEntryInput): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg(); // auth gate
  const supabase = await createClient();

  const normalized = normalizeInput(input);
  if (!normalized.manufacturer) return { error: "Give the NOA a manufacturer." };
  if (!normalized.noa_number) return { error: "Enter the NOA / FL# number." };

  // Only platform admins may change a row's visibility. For everyone else
  // the flag is ignored so a malicious payload can't publish a private NOA
  // to the shared catalog.
  const isAdmin = await isPlatformAdmin();
  const visibilityPatch: {
    visibility?: string;
    owner_org_id?: string | null;
  } = {};
  if (isAdmin && (input.visibility === "platform" || input.visibility === "org")) {
    visibilityPatch.visibility = input.visibility;
    visibilityPatch.owner_org_id =
      input.visibility === "platform" ? null : activeOrg.id;
  }

  const { error } = await supabase
    .from("noa_library")
    .update({ ...normalized, ...visibilityPatch })
    .eq("id", entryId);
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return {
        error: `Another NOA already uses ${normalized.manufacturer} ${normalized.series || ""} ${normalized.noa_number}. Change one of those fields or edit that existing entry instead.`,
      };
    }
    return { error: error.message };
  }
  revalidatePath("/noa-library");
  revalidatePath("/libraries");
  revalidatePath("/admin/noa");
  revalidatePath("/jobs", "layout");
  return { error: null };
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deleteNoaEntry(entryId: string): Promise<ActionResult> {
  await requireActiveOrg(); // auth gate; RLS restricts deletes appropriately
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("noa_library")
    .select("storage_path")
    .eq("id", entryId)
    .single();

  if (entry?.storage_path) {
    await supabase.storage.from("noa-library").remove([entry.storage_path]);
  }

  const { error } = await supabase
    .from("noa_library")
    .delete()
    .eq("id", entryId);
  if (error) return { error: error.message };
  revalidatePath("/noa-library");
  revalidatePath("/libraries");
  revalidatePath("/admin/noa");
  revalidatePath("/jobs", "layout");
  return { error: null };
}

// ─── Per-org pressure override on a platform NOA ───────────────────────────

/**
 * Save (or clear) an org's private pressure override on a platform NOA row.
 * Passing both pressures as empty strings deletes the override row entirely.
 * This never touches the underlying platform row — the whole point is that
 * every Guardian clerk sees the same private CWS 7100 pressures once the
 * boss sets them, but Premier keeps its own numbers.
 */
export async function upsertNoaOverride(
  entryId: string,
  pressurePos: string,
  pressureNeg: string,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const pos = parsePressure(pressurePos);
  const neg = parsePressure(pressureNeg);

  // If both fields are blank, delete the override — no point storing an
  // all-null row.
  if (pos == null && neg == null) {
    const { error } = await supabase
      .from("noa_library_overrides")
      .delete()
      .eq("noa_library_id", entryId)
      .eq("org_id", activeOrg.id);
    if (error) return { error: error.message };
    revalidatePath("/noa-library");
  revalidatePath("/libraries");
    revalidatePath("/admin/noa");
    revalidatePath("/jobs", "layout");
    return { error: null };
  }

  const { error } = await supabase.from("noa_library_overrides").upsert(
    {
      noa_library_id: entryId,
      org_id: activeOrg.id,
      pressure_pos: pos,
      pressure_neg: neg,
    },
    { onConflict: "noa_library_id,org_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/noa-library");
  revalidatePath("/libraries");
  revalidatePath("/admin/noa");
  revalidatePath("/jobs", "layout");
  return { error: null };
}
