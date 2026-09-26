"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, type MemberRole } from "@/lib/data/orgs";
import { permitTechSlots } from "@/lib/inventory/constants";
import { hoaTechSlots } from "@/lib/hoa/constants";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";

const ASSIGNABLE_ROLES: MemberRole[] = ["owner", "admin", "accounting", "manager", "member"];

// Lets the signed-in user pick which preset Permit Tech / HOA Tech label
// they are, without touching jobs.permit_tech or hoa_jobs.assigned_to —
// this only updates their own organization_members row so the dashboard can
// match "my jobs" against the existing tech label columns those tools
// already use. RLS permits self-updates to organization_members; this
// action does not touch the role column, so the role-protection trigger
// never fires here.
export async function updateMyTechIdentity(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { memberId, activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const permitRaw = String(formData.get("permit_tech_label") ?? "");
  const hoaRaw = String(formData.get("hoa_tech_label") ?? "");
  const permit_tech_label = permitTechSlots(activeOrg.permit_tech_seats).includes(permitRaw) ? permitRaw : null;
  const hoa_tech_label = hoaTechSlots(activeOrg.hoa_tech_seats).includes(hoaRaw) ? hoaRaw : null;

  const { error } = await supabase
    .from("organization_members")
    .update({ permit_tech_label, hoa_tech_label })
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { error: null, message: "Saved your tech identity." };
}

// Owner-only role change. The DB trigger (trg_protect_member_role) is the
// real security boundary — it rejects this update outright if the acting
// user isn't an owner — this app-level check just gives a friendlier error
// instead of a raw Postgres exception.
export async function updateMemberRole(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { role, activeOrg } = await requireActiveOrg();
  if (role !== "owner") {
    return { error: "Only the organization owner can change roles." };
  }

  const targetMemberId = String(formData.get("member_id") ?? "");
  const nextRole = String(formData.get("role") ?? "");
  if (!targetMemberId || !ASSIGNABLE_ROLES.includes(nextRole as MemberRole)) {
    return { error: "Choose a valid member and role." };
  }

  const supabase = await createClient();

  // Seat cap: moving a member INTO admin/manager/member counts against
  // that role's seat count for this org (see supabase/31_org_role_seats.sql).
  // Owner never has a cap — there's exactly one, and this action can't
  // create a second (the role-protection trigger blocks that separately).
  const seatColumn =
    nextRole === "admin" ? "admin_seats" : nextRole === "manager" ? "manager_seats" : nextRole === "member" ? "member_seats" : null;
  if (seatColumn) {
    const cap = activeOrg[seatColumn];
    const { count } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", activeOrg.id)
      .eq("role", nextRole);
    if ((count ?? 0) >= cap) {
      return { error: `This org is at its ${nextRole} seat limit (${cap}). Ask the platform admin to raise it first.` };
    }
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: nextRole })
    .eq("id", targetMemberId)
    .eq("org_id", activeOrg.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null, message: "Role updated." };
}
