"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, requireUser } from "@/lib/data/orgs";
import { permitTechSlots } from "@/lib/inventory/constants";
import { hoaTechSlots } from "@/lib/hoa/constants";
import type { TechKind } from "@/lib/tech-labels";

function validSlot(kind: TechKind, slot: string, permitSeats: number, hoaSeats: number): boolean {
  return (kind === "permit" ? permitTechSlots(permitSeats) : hoaTechSlots(hoaSeats)).includes(slot);
}

export type SaveTechNameResult = { ok: true } | { ok: false; error: string };

/**
 * Upsert the display name for a single (kind, slot) in the active org.
 * Only owners/admins can write — RLS enforces this at the DB level too.
 * Passing an empty display_name clears the override (renders slot as-is).
 */
export async function saveTechName(
  kind: TechKind,
  slot: string,
  displayName: string,
): Promise<SaveTechNameResult> {
  if (kind !== "permit" && kind !== "hoa") {
    return { ok: false, error: "Invalid tech kind." };
  }

  const user = await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Only owners and admins can rename techs." };
  }

  if (!validSlot(kind, slot, activeOrg.permit_tech_seats, activeOrg.hoa_tech_seats)) {
    return { ok: false, error: "Invalid tech slot." };
  }

  const clean = displayName.trim().slice(0, 80);
  const supabase = await createClient();
  const { error } = await supabase
    .from("org_tech_names")
    .upsert(
      {
        org_id: activeOrg.id,
        kind,
        slot,
        display_name: clean,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "org_id,kind,slot" },
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/inventory");
  revalidatePath("/hoa");
  return { ok: true };
}
