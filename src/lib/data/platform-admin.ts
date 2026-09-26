import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getSubscriptionTier, getOnboardingTier } from "@/lib/marketing/pricing";

/**
 * Whether the current user is a PermitAIO platform admin (the
 * founder/operator) — distinct from per-org roles. Runs against the
 * user's own authenticated session; RLS on platform_admins only lets a
 * user read their own row, so this never needs the service-role client.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return !!data;
}

/** Redirects to /dashboard if the current user is not a platform admin. */
export async function requirePlatformAdmin() {
  const ok = await isPlatformAdmin();
  if (!ok) redirect("/dashboard");
}

export type AdminOrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  onboarding_tier: string | null;
  onboarding_paid: boolean | null;
  member_count: number;
  job_count: number;
  owner_email: string | null;
};

export type AdminOverview = {
  orgs: AdminOrgRow[];
  totals: {
    orgCount: number;
    trialingCount: number;
    activeCount: number;
    pastDueCount: number;
    canceledCount: number;
    compedCount: number;
    mrr: number;
    onboardingRevenue: number;
  };
  /** Set when SUPABASE_SERVICE_ROLE_KEY isn't configured in this
   * environment yet — the console can't read cross-org data until it is. */
  configError?: string;
};

const EMPTY_TOTALS = {
  orgCount: 0,
  trialingCount: 0,
  activeCount: 0,
  pastDueCount: 0,
  canceledCount: 0,
  compedCount: 0,
  mrr: 0,
  onboardingRevenue: 0,
};

/**
 * Cross-tenant org overview for the owner/admin console. Uses the
 * service-role client (bypasses RLS) — this is the one place in the app
 * that intentionally reads across every organization. Only ever call this
 * after requirePlatformAdmin() has gated the page.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      orgs: [],
      totals: EMPTY_TOTALS,
      configError: err instanceof Error ? err.message : "Admin client is not configured.",
    };
  }

  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .select(
      "id, name, slug, plan, created_at, trial_ends_at, subscription_status, subscription_tier, onboarding_tier, onboarding_paid",
    )
    .order("created_at", { ascending: false });

  if (orgsError || !orgs) {
    return {
      orgs: [],
      totals: EMPTY_TOTALS,
    };
  }

  const orgIds = orgs.map((o) => o.id);

  const [{ data: members }, { data: jobs }] = await Promise.all([
    admin
      .from("organization_members")
      .select("org_id, role, user_id")
      .in("org_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("jobs")
      .select("org_id")
      .in("org_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const memberCounts = new Map<string, number>();
  const ownerUserIds = new Map<string, string>();
  for (const m of members ?? []) {
    memberCounts.set(m.org_id, (memberCounts.get(m.org_id) ?? 0) + 1);
    if (m.role === "owner" && !ownerUserIds.has(m.org_id)) {
      ownerUserIds.set(m.org_id, m.user_id);
    }
  }

  const jobCounts = new Map<string, number>();
  for (const j of jobs ?? []) {
    jobCounts.set(j.org_id, (jobCounts.get(j.org_id) ?? 0) + 1);
  }

  // Resolve owner emails via the profiles table (kept in sync with
  // auth.users by the handle_new_user trigger) rather than the admin auth
  // API — fewer calls, and profiles is already the app's source of truth
  // for displaying a user's email.
  const ownerUserIdList = Array.from(new Set(ownerUserIds.values()));
  const { data: ownerProfiles } = ownerUserIdList.length
    ? await admin.from("profiles").select("id, email").in("id", ownerUserIdList)
    : { data: [] as { id: string; email: string }[] };
  const ownerEmailByUserId = new Map(
    (ownerProfiles ?? []).map((p) => [p.id, p.email as string | null]),
  );

  let mrr = 0;
  let onboardingRevenue = 0;
  let trialingCount = 0;
  let activeCount = 0;
  let pastDueCount = 0;
  let canceledCount = 0;
  let compedCount = 0;

  const rows: AdminOrgRow[] = orgs.map((o) => {
    const status = o.subscription_status ?? "trialing";
    if (status === "trialing") trialingCount++;
    else if (status === "active") activeCount++;
    else if (status === "past_due") pastDueCount++;
    else if (status === "comped") compedCount++;
    else if (status === "canceled" || status === "unpaid" || status === "incomplete_expired")
      canceledCount++;

    // Comped orgs (complimentary access, no real Stripe charge) never
    // count toward MRR or onboarding revenue — those figures should
    // reflect real collected money only.
    if ((status === "active" || status === "past_due") && o.subscription_tier) {
      const tier = getSubscriptionTier(o.subscription_tier);
      if (tier) mrr += tier.price;
    }
    if (status !== "comped" && o.onboarding_paid && o.onboarding_tier) {
      const tier = getOnboardingTier(o.onboarding_tier);
      if (tier) onboardingRevenue += tier.price;
    }

    const ownerUserId = ownerUserIds.get(o.id);

    return {
      ...o,
      member_count: memberCounts.get(o.id) ?? 0,
      job_count: jobCounts.get(o.id) ?? 0,
      owner_email: ownerUserId ? ownerEmailByUserId.get(ownerUserId) ?? null : null,
    };
  });

  return {
    orgs: rows,
    totals: {
      orgCount: orgs.length,
      trialingCount,
      activeCount,
      pastDueCount,
      canceledCount,
      compedCount,
      mrr,
      onboardingRevenue,
    },
  };
}

/** Same org rows as getAdminOverview(), for pages (like /admin/trials)
 * that only need the row list, not the aggregate totals — avoids keeping
 * two separate queries in sync. */
export async function getAdminOrgs(): Promise<{ orgs: AdminOrgRow[]; configError?: string }> {
  const overview = await getAdminOverview();
  return { orgs: overview.orgs, configError: overview.configError };
}
