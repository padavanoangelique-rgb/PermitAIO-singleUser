"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITABLE_ROLES, type InvitableRole } from "@/lib/data/invite-roles";
import { SITE_URL } from "@/lib/site-config";
import { recordAssignedRole } from "@/lib/record-assigned-role";
import { revalidatePath } from "next/cache";

export interface PlatformInviteResult {
  error: string | null;
  message?: string;
}

// Which organizations column caps how many members can hold a given
// invitable role — see supabase/31_org_role_seats.sql.
const ROLE_SEAT_COLUMN: Record<InvitableRole, "admin_seats" | "manager_seats" | "member_seats"> = {
  admin: "admin_seats",
  accounting: "member_seats",
  manager: "manager_seats",
  member: "member_seats",
};

/**
 * Platform-admin version of inviteMember (src/lib/actions/invites.ts) —
 * same organization_invites insert + best-effort Supabase invite email,
 * but for an org the caller doesn't belong to, so it can't use
 * requireActiveOrg()/the RLS-scoped client the org-scoped version relies
 * on. Uses createAdminClient() instead, gated by requirePlatformAdmin().
 *
 * Real invite roles are 'admin' | 'manager' | 'member' (INVITABLE_ROLES —
 * see src/lib/data/invite-roles.ts). There is no 'owner' or 'viewer' role
 * anywhere in this schema; organization_invites.role has a hard check
 * constraint restricting it to exactly those three values.
 */
export async function platformAdminInviteToOrg(
  orgId: string,
  email: string,
  role: InvitableRole,
): Promise<PlatformInviteResult> {
  await requirePlatformAdmin();

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return { error: "Choose a valid role." };
  }

  const admin = createAdminClient();

  // Seat cap — same numbers set on /admin/roles (supabase/31_org_role_seats.sql).
  const seatColumn = ROLE_SEAT_COLUMN[role];
  const { data: orgRow } = await admin
    .from("organizations")
    .select(seatColumn)
    .eq("id", orgId)
    .maybeSingle();
  const cap = (orgRow as Record<string, number> | null)?.[seatColumn];
  if (typeof cap === "number") {
    const { count: roleCount } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("role", role);
    if ((roleCount ?? 0) >= cap) {
      return { error: `This org is at its ${role} seat limit (${cap}). Raise it in Role Seats first.` };
    }
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // The unique partial index on (org_id, lower(email)) where
  // accepted_at is null and revoked_at is null already stops duplicate
  // pending invites — no extra dedupe query needed here.
  const { error: insertError } = await admin
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email: normalizedEmail,
      role,
      invited_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "There's already a pending invite for that email on this org." };
    }
    return { error: insertError.message };
  }

  await recordAssignedRole(orgId, normalizedEmail, role);

  // Best-effort invite email — mirrors inviteMember's pattern. Only
  // succeeds for emails with no existing account; an existing user sees
  // the invite as an "Accept" banner next time they're signed in.
  const { error: inviteEmailError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: { invited_org_id: orgId, invited_role: role },
    redirectTo: `${SITE_URL}/invite/accept`,
  });

  revalidatePath("/admin/trials");

  if (inviteEmailError) {
    const alreadyRegistered = inviteEmailError.message?.toLowerCase().includes("already") ?? false;
    if (alreadyRegistered) {
      return {
        error: null,
        message: "This person already has a PermitAIO account — they'll see the invite to accept next time they sign in.",
      };
    }
    return {
      error: null,
      message: `Invite created, but the invite email couldn't be sent (${inviteEmailError.message}).`,
    };
  }

  return { error: null, message: `Invite email sent to ${normalizedEmail}.` };
}
