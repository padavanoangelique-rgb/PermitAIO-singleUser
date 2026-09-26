"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";

export async function setOrgRoleSeats(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) return;

  const permitTechs = Number(formData.get("permitTechs") ?? 3);
  const hoaTechs = Number(formData.get("hoaTechs") ?? 3);
  const admins = Number(formData.get("admins") ?? 1);
  const managers = Number(formData.get("managers") ?? 2);
  const members = Number(formData.get("members") ?? 5);

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      permit_tech_seats: Number.isFinite(permitTechs) ? permitTechs : 3,
      hoa_tech_seats: Number.isFinite(hoaTechs) ? hoaTechs : 3,
      admin_seats: Number.isFinite(admins) ? admins : 1,
      manager_seats: Number.isFinite(managers) ? managers : 2,
      member_seats: Number.isFinite(members) ? members : 5,
    } as never)
    .eq("id", orgId);

  revalidatePath("/admin/roles");
}
