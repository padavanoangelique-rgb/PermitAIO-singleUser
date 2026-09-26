"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveOrg, canManageOrg, ACTIVE_ORG_COOKIE } from "@/lib/data/orgs";
import { isSoloAccountTier } from "@/lib/marketing/pricing";
import { INVITABLE_ROLES, type InvitableRole } from "@/lib/data/invite-roles";
import { SITE_URL } from "@/lib/site-config";
import { recordAssignedRole } from "@/lib/record-assigned-role";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { ActionResult } from "./auth";

const SOLO_SEAT_LIMIT_MESSAGE =
  "This is a Solo Owner account — it's single-seat. Change the account type in admin settings to add a teammate.";

// Which organizations column caps how many members can hold a given
// invitable role — see supabase/31_org_role_seats.sql. Owner has no cap
// (there's exactly one per org, enforced elsewhere).
const ROLE_SEAT_COLUMN: Record<InvitableRole, "admin_seats" | "manager_seats" | "member_seats"> = {
  admin: "admin_seats",
  accounting: "member_seats",
  manager: "manager_seats",
  member: "member_seats",
};

function seatLimitMessage(role: InvitableRole, cap: number) {
  return `This org is at its ${role} seat limit (${cap}). Ask the platform admin to raise it in Role Seats, or free up a seat first.`;
}

function inviteRedirect() {
  return `${SITE_URL}/invite/accept`;
}

export async function inviteMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { role: myRole, activeOrg } = await requireActiveOrg();
  if (!canManageOrg(myRole)) {
    return { error: "Only an owner or admin can invite teammates." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (!INVITABLE_ROLES.includes(role as InvitableRole)) {
    return { error: "Choose a role for this teammate." };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  if (email === userData.user.email?.toLowerCase()) {
    return { error: "You're already a member of this organization." };
  }

  if (isSoloAccountTier(activeOrg.subscription_tier)) {
    const { count } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", activeOrg.id);
    if ((count ?? 0) >= 1) {
      return { error: SOLO_SEAT_LIMIT_MESSAGE };
    }
  }

  const seatColumn = ROLE_SEAT_COLUMN[role as InvitableRole];
  const cap = activeOrg[seatColumn];
  const { count: roleCount } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", activeOrg.id)
    .eq("role", role);
  if ((roleCount ?? 0) >= cap) {
    return { error: seatLimitMessage(role as InvitableRole, cap) };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existingProfile) {
    const { data: existingMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("org_id", activeOrg.id)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (existingMember) {
      return { error: "That person is already a member of this organization." };
    }
  }

  const { data: invite, error: insertError } = await supabase
    .from("organization_invites")
    .insert({
      org_id: activeOrg.id,
      email,
      role,
      invited_by: userData.user.id,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "There's already a pending invite for that email." };
    }
    return { error: insertError.message };
  }

  await recordAssignedRole(activeOrg.id, email, role);

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    revalidatePath("/settings");
    return {
      error: null,
      message:
        "Invite created, but no invite email was sent — SUPABASE_SERVICE_ROLE_KEY isn't configured in this environment.",
    };
  }

  const { error: inviteEmailError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { invited_org_id: activeOrg.id, invited_role: role },
    redirectTo: inviteRedirect(),
  });

  revalidatePath("/settings");

  if (inviteEmailError) {
    const alreadyRegistered =
      inviteEmailError.message?.toLowerCase().includes("already") ?? false;
    if (alreadyRegistered) {
      return {
        error: null,
        message:
          "This person already has a PermitAIO account — they'll see the invite to accept next time they sign in.",
      };
    }
    return {
      error: null,
      message: `Invite created, but the invite email couldn't be sent (${inviteEmailError.message}).`,
    };
  }

  void invite;
  return { error: null, message: `Invite email sent to ${email}.` };
}

export async function revokeInvite(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { role: myRole, activeOrg } = await requireActiveOrg();
  if (!canManageOrg(myRole)) {
    return { error: "Only an owner or admin can cancel invites." };
  }

  const inviteId = String(formData.get("invite_id") ?? "");
  if (!inviteId) return { error: "Missing invite." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("org_id", activeOrg.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null, message: "Invite cancelled." };
}

export async function acceptInvite(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const inviteId = String(formData.get("invite_id") ?? "");
  if (!inviteId) return { error: "Missing invite." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: invite, error: fetchError } = await supabase
    .from("organization_invites")
    .select(
      "id, org_id, role, email, accepted_at, revoked_at, expires_at, organizations(slug, subscription_tier, admin_seats, manager_seats, member_seats)",
    )
    .eq("id", inviteId)
    .maybeSingle();

  if (fetchError || !invite) {
    return { error: "That invite no longer exists." };
  }
  if (invite.accepted_at || invite.revoked_at) {
    return { error: "That invite is no longer available." };
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { error: "That invite has expired." };
  }

  const org = invite.organizations as unknown as {
    slug: string;
    subscription_tier: string | null;
    admin_seats: number;
    manager_seats: number;
    member_seats: number;
  } | null;

  if (isSoloAccountTier(org?.subscription_tier ?? null)) {
    const { count } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", invite.org_id);
    if ((count ?? 0) >= 1) {
      return { error: SOLO_SEAT_LIMIT_MESSAGE };
    }
  }

  const seatColumn = ROLE_SEAT_COLUMN[invite.role as InvitableRole];
  if (org && seatColumn) {
    const cap = org[seatColumn];
    const { count: roleCount } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", invite.org_id)
      .eq("role", invite.role);
    if ((roleCount ?? 0) >= cap) {
      return { error: seatLimitMessage(invite.role as InvitableRole, cap) };
    }
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ org_id: invite.org_id, user_id: userData.user.id, role: invite.role });

  if (memberError && memberError.code !== "23505") {
    return { error: memberError.message };
  }

  await supabase
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const orgSlug = org?.slug;
  if (orgSlug) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, orgSlug, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function declineInvite(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const inviteId = String(formData.get("invite_id") ?? "");
  if (!inviteId) return { error: "Missing invite." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { error: null, message: "Invite declined." };
}
