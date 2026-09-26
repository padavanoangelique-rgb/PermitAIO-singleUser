"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/data/platform-admin";

export type PlatformAdminActionResult = {
  ok: boolean;
  error?: string;
};

/**
 * Toggle a user's platform-admin status. Only callable by an existing
 * platform admin. Writes to both `platform_admins` (the authoritative
 * table read by RLS + is_platform_admin() SQL fn) and mirrors the flag
 * on `profiles.is_platform_admin` so any legacy readers stay consistent.
 */
export async function setPlatformAdmin(
  userId: string,
  makeAdmin: boolean,
): Promise<PlatformAdminActionResult> {
  if (!(await isPlatformAdmin())) {
    return { ok: false, error: "Only platform admins can grant admin access." };
  }
  if (!userId) {
    return { ok: false, error: "Missing user id." };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Admin client not configured.",
    };
  }

  if (makeAdmin) {
    const { error } = await admin
      .from("platform_admins")
      .upsert({ user_id: userId }, { onConflict: "user_id" });
    if (error) return { ok: false, error: error.message };
  } else {
    // Guard against locking everyone out. If this would drop the last
    // remaining admin, refuse.
    const { count } = await admin
      .from("platform_admins")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error: "Cannot remove the last platform admin.",
      };
    }
    const { error } = await admin
      .from("platform_admins")
      .delete()
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
  }

  // Mirror to profiles.is_platform_admin so legacy readers stay in sync.
  await admin
    .from("profiles")
    .update({ is_platform_admin: makeAdmin })
    .eq("id", userId);

  revalidatePath("/admin/users");
  return { ok: true };
}
