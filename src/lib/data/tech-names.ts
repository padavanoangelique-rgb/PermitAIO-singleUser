import { createClient } from "@/lib/supabase/server";
import type { TechKind, TechNameMap } from "@/lib/tech-labels";

/**
 * Load the org's per-slot display names for one kind (permit or hoa).
 * Returns a map keyed by slot — missing slots simply won't appear in the map.
 * Falls back to an empty map on error so callers always get a safe object.
 */
export async function getTechNames(orgId: string, kind: TechKind): Promise<TechNameMap> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_tech_names")
    .select("slot, display_name")
    .eq("org_id", orgId)
    .eq("kind", kind);
  if (error || !data) return {};
  const map: TechNameMap = {};
  for (const row of data) {
    if (row.slot && typeof row.display_name === "string") {
      map[row.slot] = row.display_name;
    }
  }
  return map;
}

/** Load both permit and hoa maps in one round-trip. */
export async function getAllTechNames(
  orgId: string,
): Promise<{ permit: TechNameMap; hoa: TechNameMap }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_tech_names")
    .select("kind, slot, display_name")
    .eq("org_id", orgId);
  const permit: TechNameMap = {};
  const hoa: TechNameMap = {};
  if (error || !data) return { permit, hoa };
  for (const row of data) {
    if (!row.slot || typeof row.display_name !== "string") continue;
    if (row.kind === "permit") permit[row.slot] = row.display_name;
    else if (row.kind === "hoa") hoa[row.slot] = row.display_name;
  }
  return { permit, hoa };
}
