"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";

export async function setServiceDashboard(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) return;

  const enabled = formData.get("enabled") === "on";
  const managers = Number(formData.get("managers") ?? 2);
  const techs = Number(formData.get("techs") ?? 8);

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      service_dashboard_enabled: enabled,
      service_seat_managers: Number.isFinite(managers) ? managers : 2,
      service_seat_techs: Number.isFinite(techs) ? techs : 8,
    } as never)
    .eq("id", orgId);

  revalidatePath("/admin/service");
}
