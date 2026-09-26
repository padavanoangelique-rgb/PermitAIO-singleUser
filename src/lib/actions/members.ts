"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveOrg, requireUser, canManageOrg } from "@/lib/data/orgs";
import type { ActionResult } from "./auth";

/** Remove a teammate from this company. Does not delete their login worldwide. */
export async function removeMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const { role: myRole, activeOrg } = await requireActiveOrg();
  if (!canManageOrg(myRole)) {
    return { error: "Only an owner or admin can remove teammates." };
  }

  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) return { error: "Missing teammate." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("org_id", activeOrg.id)
    .maybeSingle();

  if (!row) return { error: "That person is not on this team." };
  if (row.user_id === user.id) return { error: "You cannot remove yourself." };
  if (row.role === "owner" && myRole !== "owner") {
    return { error: "Only the owner can remove another owner." };
  }

  if (row.role === "owner") {
    const { data: owners } = await supabase
      .from("organization_members")
      .select("id")
      .eq("org_id", activeOrg.id)
      .eq("role", "owner");
    if ((owners?.length ?? 0) <= 1) {
      return { error: "Keep at least one owner on the company." };
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", row.user_id)
    .maybeSingle();

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("org_id", activeOrg.id);

  if (error) {
    try {
      const admin = createAdminClient();
      const { error: adminError } = await admin
        .from("organization_members")
        .delete()
        .eq("id", memberId)
        .eq("org_id", activeOrg.id);
      if (adminError) return { error: adminError.message };
    } catch {
      return { error: error.message };
    }
  }

  if (profile?.email) {
    try {
      const db = supabase as unknown as {
        from: (t: string) => {
          delete: () => {
            eq: (c: string, v: string) => {
              eq: (c2: string, v2: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        };
      };
      await db.from("install_members").delete().eq("org_id", activeOrg.id).eq("email", profile.email);
    } catch {
      /* install roster optional */
    }
  }

  revalidatePath("/settings");
  revalidatePath("/install");
  return { error: null, message: "Removed from this company." };
}
