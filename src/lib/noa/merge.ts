import type { Tables } from "@/lib/supabase/types";

export type NoaEntry = Tables<"noa_library">;
export type NoaOverride = Tables<"noa_library_overrides">;

/**
 * A NOA row as it looks to a specific org: platform rows have their
 * pressures replaced by the org's own override (when one exists), and
 * we surface enough metadata for the UI to gate row actions.
 *
 * Fields:
 *   - `visibility`           — 'platform' or 'org'.
 *   - `override_id`          — non-null iff this org has an override.
 *   - `has_override`         — convenience mirror.
 *   - `effective_pressure_*` — override values when overridden, otherwise the base values.
 *   - `base_pressure_*`      — the original platform values (kept so admins editing platform rows can still see the platform baseline even after Guardian has set an override on their own copy).
 *   - `can_edit_entry`       — the current user can edit the row itself (platform admin, or org member on their own org row).
 *   - `can_override`         — the current user can set/clear pressure overrides on this row (any org member on a platform row).
 */
export type MergedNoaEntry = NoaEntry & {
  effective_pressure_pos: number | null;
  effective_pressure_neg: number | null;
  base_pressure_pos: number | null;
  base_pressure_neg: number | null;
  override_id: string | null;
  has_override: boolean;
  can_edit_entry: boolean;
  can_override: boolean;
};

/**
 * Merge platform + org NOA rows with per-org overrides so callers see one
 * unified list. `activeOrgId` is the org whose overrides win; `isAdmin`
 * flips edit-entry rights for platform rows.
 */
export function mergeNoaEntries(
  entries: NoaEntry[],
  overrides: NoaOverride[],
  activeOrgId: string,
  isAdmin: boolean,
): MergedNoaEntry[] {
  const overrideByEntryId = new Map<string, NoaOverride>();
  for (const o of overrides) {
    if (o.org_id === activeOrgId) overrideByEntryId.set(o.noa_library_id, o);
  }

  return entries.map((e) => {
    const ov = overrideByEntryId.get(e.id) ?? null;
    const isPlatform = e.visibility === "platform";
    const belongsToOrg = e.owner_org_id === activeOrgId;

    // Whether the current user can edit the underlying row:
    //   - platform rows: only platform admins
    //   - org rows: only the owning org's members
    const can_edit_entry = isPlatform ? isAdmin : belongsToOrg;

    // Anyone can override a platform row for their own org (the RLS
    // policy on noa_library_overrides is org-scoped). Overrides don't
    // exist for org rows — those users can just edit the row itself.
    const can_override = isPlatform;

    return {
      ...e,
      base_pressure_pos: e.pressure_pos,
      base_pressure_neg: e.pressure_neg,
      effective_pressure_pos: ov?.pressure_pos ?? e.pressure_pos,
      effective_pressure_neg: ov?.pressure_neg ?? e.pressure_neg,
      override_id: ov?.id ?? null,
      has_override: !!ov,
      can_edit_entry,
      can_override,
    };
  });
}
