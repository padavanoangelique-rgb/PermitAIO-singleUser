"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg, canManageOrg } from "@/lib/data/orgs";
import { OFFICE_ASSIGN_ROLES } from "@/lib/assigned-roles";
import { recordAssignedRole } from "@/lib/record-assigned-role";
import { permitTechSlots } from "@/lib/inventory/constants";
import { hoaTechSlots } from "@/lib/hoa/constants";

export async function assignOfficeRole(formData: FormData) {
  const user = await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  if (!canManageOrg(role)) return;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const assignedRole = String(formData.get("role") ?? "");
  const slot = String(formData.get("slot") ?? "").trim() || null;
  if (!email || !email.includes("@")) {
    redirect("/settings?mail=" + encodeURIComponent("Enter a valid email."));
  }
  if (!OFFICE_ASSIGN_ROLES.some((r) => r.value === assignedRole)) {
    redirect("/settings?mail=" + encodeURIComponent("Pick a role."));
  }
  if (assignedRole === "permit_tech") {
    const slots = permitTechSlots(activeOrg.permit_tech_seats);
    if (!slot || !slots.includes(slot)) {
      redirect("/settings?mail=" + encodeURIComponent("Pick a Permit tech desk."));
    }
  }
  if (assignedRole === "hoa_tech") {
    const slots = hoaTechSlots(activeOrg.hoa_tech_seats);
    if (!slot || !slots.includes(slot)) {
      redirect("/settings?mail=" + encodeURIComponent("Pick an HOA tech desk."));
    }
  }

  const err = await recordAssignedRole(activeOrg.id, email, assignedRole, slot);
  if (err) {
    redirect("/settings?mail=" + encodeURIComponent(err));
  }

  const supabase = await createClient();
  await supabase.from("organization_invites").insert({
    org_id: activeOrg.id,
    email,
    role: "member",
    invited_by: user.id,
  });

  revalidatePath("/settings");
  redirect(
    "/settings?mail=" +
      encodeURIComponent(`${email} is assigned. They go to permitaio.com/join, enter the company code, and create a password.`),
  );
}
