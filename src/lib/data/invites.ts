import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/data/orgs";

export type PendingInvite = {
  id: string;
  org_id: string;
  email: string;
  role: MemberRole;
  created_at: string;
  expires_at: string;
  organizations: { name: string } | null;
};

export type OrgInvite = {
  id: string;
  email: string;
  role: MemberRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

/** Every still-live invite (unaccepted, unrevoked, unexpired) addressed to
 * the current user's own email, across any org — regardless of whether
 * they already belong to other orgs. Backs the "you've been invited"
 * banner shown in /onboarding and the app shell. */
export async function getPendingInvitesForCurrentUser(): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("organization_invites")
    .select("id, org_id, email, role, created_at, expires_at, organizations(name)")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as PendingInvite[];
}

/** Every invite (any status) ever sent for an org — for the Settings page
 * "Pending invites" list. Caller must already be gated by canManageOrg();
 * RLS (is_org_admin) enforces this independently. */
export async function getOrgInvites(orgId: string): Promise<OrgInvite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_invites")
    .select("id, email, role, created_at, expires_at, accepted_at, revoked_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as OrgInvite[];
}
