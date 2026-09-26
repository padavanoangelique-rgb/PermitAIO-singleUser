import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const ACTIVE_ORG_COOKIE = "permitaio_active_org";

export type MemberRole = "owner" | "admin" | "manager" | "member" | "accounting";

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete_expired"
  // Complimentary/free access granted by the platform owner (no Stripe
  // subscription attached). Never blocked, and excluded from MRR and
  // onboarding-revenue totals in the owner console.
  | "comped"
  | string;

export type OrgMembership = {
  id: string;
  org_id: string;
  role: MemberRole;
  permit_tech_label: string | null;
  hoa_tech_label: string | null;
  organizations: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    trial_ends_at: string | null;
    subscription_status: BillingStatus | null;
    subscription_tier: string | null;
    onboarding_tier: string | null;
    onboarding_paid: boolean | null;
    /** Seat counts set by the platform admin during onboarding (see
     * supabase/31_org_role_seats.sql) — how many of each position this
     * company is onboarded for. */
    permit_tech_seats: number;
    hoa_tech_seats: number;
    admin_seats: number;
    manager_seats: number;
    member_seats: number;
  };
};

// Statuses that always block access, regardless of trial_ends_at.
const ALWAYS_BLOCKED_STATUSES = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

/** Whether an org's access should be blocked pending payment. Active and
 * past_due (Stripe's own retry grace period) are never blocked here. A
 * trialing org is blocked once its trial_ends_at has passed. */
export function isOrgBillingBlocked(org: {
  subscription_status: BillingStatus | null;
  trial_ends_at: string | null;
}): boolean {
  const status = org.subscription_status ?? "trialing";
  if (status === "active" || status === "past_due" || status === "comped") return false;
  if (ALWAYS_BLOCKED_STATUSES.has(status)) return true;
  if (status === "trialing") {
    if (!org.trial_ends_at) return false;
    return new Date(org.trial_ends_at).getTime() < Date.now();
  }
  return false;
}

/** Owners/admins manage org settings and the member roster. */
export function canManageOrg(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/** Accounting ledger: owners, admins, and the accounting role. */
export function canAccessAccounting(role: MemberRole): boolean {
  return role === "owner" || role === "admin" || role === "accounting";
}

/** Owners/admins/managers can reassign which tech is working a job and see
 * the team-wide status breakdown — managers get this without full org-admin
 * access to settings/billing/roster management. */
export function canAssignJobs(role: MemberRole): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

/** Only an owner may change another member's role (also enforced server-side
 * by a DB trigger, so this is a UI convenience, not the security boundary). */
export function canChangeRoles(role: MemberRole): boolean {
  return role === "owner";
}

/** Returns the signed-in user, redirecting to /login if there isn't one. */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/login");
  }
  return data.user;
}

/** All organizations the current user belongs to, with their role in each. */
export async function getUserMemberships(): Promise<OrgMembership[]> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return [];

  // RLS on organization_members lets a member see every membership row in
  // orgs they belong to (so teammates can see each other) — filter to the
  // current user's own rows here, otherwise any org with 2+ members returns
  // one row per teammate instead of one row per org the user belongs to.
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "id, org_id, role, permit_tech_label, hoa_tech_label, organizations(id, name, slug, plan, trial_ends_at, subscription_status, subscription_tier, onboarding_tier, onboarding_paid, permit_tech_seats, hoa_tech_seats, admin_seats, manager_seats, member_seats)",
    )
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as OrgMembership[];
}

/**
 * Resolves the "active" org for the current request. Reads the org slug
 * from the `org` cookie (set on org switch); falls back to the first org
 * the user belongs to. Redirects to /onboarding if the user has none —
 * except platform admins, who are sent to /admin instead (they are not
 * meant to have an org and should never see the onboarding wizard).
 */
export async function requireActiveOrg() {
  const memberships = await getUserMemberships();

  if (memberships.length === 0) {
    const { isPlatformAdmin } = await import("@/lib/data/platform-admin");
    if (await isPlatformAdmin()) {
      redirect("/admin");
    }
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const activeSlug = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active =
    memberships.find((m) => m.organizations.slug === activeSlug) ??
    memberships[0];

  return {
    memberships,
    activeOrg: active.organizations,
    role: active.role,
    memberId: active.id,
    permitTechLabel: active.permit_tech_label,
    hoaTechLabel: active.hoa_tech_label,
  };
}
