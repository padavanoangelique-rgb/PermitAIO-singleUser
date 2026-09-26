import { createAdminClient } from "@/lib/supabase/admin";

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  is_platform_admin: boolean;
  memberships: Array<{
    org_id: string;
    org_name: string;
    org_slug: string;
    role: string;
  }>;
  job_count: number;
};

export type AdminUsersResult = {
  users: AdminUserRow[];
  configError?: string;
};

/**
 * Cross-tenant user directory for the owner/admin console. Uses the
 * service-role client — RLS bypass — and must only be called after
 * requirePlatformAdmin() has gated the caller.
 *
 * Users are joined against organization_members and platform_admins so
 * each row shows every org they belong to plus whether they're a
 * PermitAIO founder-level admin.
 */
export async function getAdminUsers(): Promise<AdminUsersResult> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      users: [],
      configError: err instanceof Error ? err.message : "Admin client is not configured.",
    };
  }

  // Pull every profile in one shot. profiles is populated by the
  // handle_new_user trigger, so it's the app-level source of truth for
  // "who has an account here".
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, full_name, created_at")
    .order("created_at", { ascending: false });

  if (profilesError || !profiles) {
    return { users: [] };
  }

  const userIds = profiles.map((p) => p.id);
  const idFilter = userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"];

  const [
    { data: memberships },
    { data: platformAdmins },
    { data: orgs },
    { data: jobs },
  ] = await Promise.all([
    admin
      .from("organization_members")
      .select("user_id, org_id, role")
      .in("user_id", idFilter),
    admin.from("platform_admins").select("user_id"),
    admin.from("organizations").select("id, name, slug"),
    admin.from("jobs").select("created_by").in("created_by", idFilter),
  ]);

  const orgById = new Map(
    (orgs ?? []).map((o) => [o.id, { name: o.name, slug: o.slug }]),
  );

  const membershipsByUser = new Map<string, AdminUserRow["memberships"]>();
  for (const m of memberships ?? []) {
    const org = orgById.get(m.org_id);
    if (!org) continue;
    const list = membershipsByUser.get(m.user_id) ?? [];
    list.push({
      org_id: m.org_id,
      org_name: org.name,
      org_slug: org.slug,
      role: m.role,
    });
    membershipsByUser.set(m.user_id, list);
  }

  const platformAdminSet = new Set((platformAdmins ?? []).map((p) => p.user_id));

  const jobCounts = new Map<string, number>();
  for (const j of jobs ?? []) {
    if (!j.created_by) continue;
    jobCounts.set(j.created_by, (jobCounts.get(j.created_by) ?? 0) + 1);
  }

  // Last-sign-in timestamps live in auth.users and aren't exposed via a
  // PostgREST view, so pull them from the admin auth API in a single
  // paginated pass. If it fails (network/quota) we degrade gracefully by
  // leaving last_sign_in_at null — the table stays useful.
  const lastSignInByUser = new Map<string, string | null>();
  try {
    let page = 1;
    // Supabase caps perPage at 1000. For PermitAIO's scale this is
    // effectively a single request; the loop is defensive.
    while (page < 20) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error || !data) break;
      for (const u of data.users) {
        lastSignInByUser.set(u.id, u.last_sign_in_at ?? null);
      }
      if (data.users.length < 1000) break;
      page += 1;
    }
  } catch {
    // Ignore — degrade gracefully.
  }

  const users: AdminUserRow[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    created_at: p.created_at,
    last_sign_in_at: lastSignInByUser.get(p.id) ?? null,
    is_platform_admin: platformAdminSet.has(p.id),
    memberships: membershipsByUser.get(p.id) ?? [],
    job_count: jobCounts.get(p.id) ?? 0,
  }));

  return { users };
}
