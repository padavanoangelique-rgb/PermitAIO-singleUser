import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { NoaEntry, NoaOverride } from "./merge";

/**
 * Load NOA library entries with each row's pressures already resolved to
 * the org's effective values (per-org override, when present, wins over
 * the platform baseline). Every consumer that only cares about the final
 * numbers — floor-plan match, NOA panel, permit-package ZIP, roofing
 * checklist — should use this instead of hand-rolling the merge.
 *
 * The returned rows keep the `noa_library` row shape so existing matchers
 * (`matchNoaLibrary`, `matchMullions`, `matchRoofingComponents`) don't
 * need to know overrides exist.
 */
export async function loadNoaLibraryEffective(
  supabase: SupabaseClient<Database>,
): Promise<NoaEntry[]> {
  const [libRes, ovRes] = await Promise.all([
    supabase.from("noa_library").select("*"),
    supabase.from("noa_library_overrides").select("*"),
  ]);

  const rows = (libRes.data ?? []) as NoaEntry[];
  const overrides = (ovRes.data ?? []) as NoaOverride[];
  const overrideById = new Map<string, NoaOverride>();
  for (const o of overrides) overrideById.set(o.noa_library_id, o);

  return rows.map((r) => {
    const ov = overrideById.get(r.id);
    if (!ov) return r;
    return {
      ...r,
      pressure_pos: ov.pressure_pos ?? r.pressure_pos,
      pressure_neg: ov.pressure_neg ?? r.pressure_neg,
    };
  });
}
