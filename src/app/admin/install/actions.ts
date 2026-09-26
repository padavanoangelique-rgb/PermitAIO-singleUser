"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";

export async function setInstallDashboard(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) return;

  const enabled = formData.get("enabled") === "on";
  const managers = Number(formData.get("managers") ?? 4);
  const pms = Number(formData.get("pms") ?? 4);
  const installers = Number(formData.get("installers") ?? 8);

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      install_dashboard_enabled: enabled,
      install_seat_managers: Number.isFinite(managers) ? managers : 4,
      install_seat_pms: Number.isFinite(pms) ? pms : 4,
      install_seat_installers: Number.isFinite(installers) ? installers : 8,
    } as never)
    .eq("id", orgId);

  revalidatePath("/admin/install");
}
