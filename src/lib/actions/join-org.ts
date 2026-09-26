"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE, canManageOrg, requireActiveOrg, requireUser } from "@/lib/data/orgs";
import { isSoloAccountTier } from "@/lib/marketing/pricing";
import { permitTechSlots } from "@/lib/inventory/constants";
import { hoaTechSlots } from "@/lib/hoa/constants";
import { ASSIGNED_DEST } from "@/lib/assigned-roles";
import type { ActionResult } from "./auth";

function normalizeCode(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 4);
}

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  join_code: string | null;
  subscription_tier: string | null;
  admin_seats: number;
  manager_seats: number;
  member_seats: number;
};

const ROLE_SEAT_COLUMN: Record<string, "admin_seats" | "manager_seats" | "member_seats"> = {
  admin: "admin_seats",
  accounting: "member_seats",
  manager: "manager_seats",
  member: "member_seats",
};

function orgsTable(admin: ReturnType<typeof createAdminClient>) {
  return admin.from("organizations") as unknown as {
    select: (cols: string) => {
      ilike: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          limit: (n: number) => Promise<{ data: OrgRow[] | null; error: { message: string } | null }>;
        };
      };
    };
    update: (vals: { join_code: string }) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
}

export async function joinOrgWithCode(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const email = (user.email ?? "").trim().toLowerCase();
  const name = String(formData.get("company") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));

  if (!email) return { error: "Your account needs an email to join a company." };
  if (name.length < 3) return { error: "Type the company name (at least 3 letters)." };
  if (code.length !== 4) return { error: "Enter the 4-digit company code." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Join is not available in this environment." };
  }

  const { data: orgs, error: orgError } = await orgsTable(admin)
    .select("id, name, slug, join_code, subscription_tier, admin_seats, manager_seats, member_seats")
    .ilike("name", `%${name}%`)
    .eq("join_code", code)
    .limit(5);

  if (orgError) return { error: orgError.message };
  if (!orgs || orgs.length === 0) {
    return { error: "No company matched that name and code." };
  }
  if (orgs.length > 1) {
    return { error: "More than one company matched. Type more of the name." };
  }

  const org = orgs[0];

  if (isSoloAccountTier(org.subscription_tier)) {
    const { count } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id);
    if ((count ?? 0) >= 1) {
      return {
        error: `${org.name} is a Solo Owner account — it's single-seat and already has its one user.`,
      };
    }
  }

  const { data: invite } = await admin
    .from("organization_invites")
    .select("id, role, accepted_at, revoked_at, expires_at")
    .eq("org_id", org.id)
    .ilike("email", email)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invite || invite.accepted_at) {
    return {
      error: `This email is not on ${org.name}'s allowed list. Ask an admin to invite ${email} first.`,
    };
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { error: "That invite expired. Ask an admin to send a new one." };
  }

  const inviteRole = invite.role ?? "member";
  const seatColumn = ROLE_SEAT_COLUMN[inviteRole];
  if (seatColumn) {
    const cap = org[seatColumn];
    const { count: roleCount } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("role", inviteRole);
    if ((roleCount ?? 0) >= cap) {
      return {
        error: `${org.name} is at its ${inviteRole} seat limit (${cap}). Ask the platform admin to raise it, or free up a seat first.`,
      };
    }
  }

  const { error: memberError } = await admin.from("organization_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: invite.role ?? "member",
  });
  if (memberError && memberError.code !== "23505") {
    return { error: memberError.message };
  }

  await admin
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, org.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function setJoinCode(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { role, activeOrg } = await requireActiveOrg();
  if (!canManageOrg(role)) return { error: "Only an owner or admin can change the join code." };
  const next = normalizeCode(String(formData.get("code") ?? ""));
  if (next.length !== 4) return { error: "Use a 4-digit code." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Could not save the code in this environment." };
  }
  const { error } = await orgsTable(admin).update({ join_code: next }).eq("id", activeOrg.id);
  if (error) {
    if (error.message.toLowerCase().includes("unique") || error.message.toLowerCase().includes("duplicate")) {
      return { error: "That code is already used by another company." };
    }
    return { error: error.message };
  }
  revalidatePath("/settings");
  return { error: null, message: `Join code is ${next}` };
}

// Roles a person can self-select after signing in with the company's join
// code. install_manager is deliberately excluded — that's assigned by an
// existing admin (InstallManagerCard), not self-claimed.
const OPEN_JOIN_ROLES = new Set([
  "permit_tech",
  "hoa_tech",
  "manager",
  "account_manager",
  "project_manager",
  "installer",
  "runner",
  "service_tech",
]);

const INSTALL_ROLES = new Set(["account_manager", "project_manager", "installer"]);
const RUNNER_ROLES = new Set(["runner"]);
const SERVICE_ROLES = new Set(["service_tech"]);

/**
 * Self-serve join reached by scanning a Settings-generated QR code. Does
 * NOT require a pre-existing organization_invites row — the person joins
 * immediately as a base "member" so the app works right away, and we
 * record which role they picked in role_join_requests for an owner/admin
 * to confirm on the Settings page.
 */
export async function joinOrgOpenRole(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const email = (user.email ?? "").trim().toLowerCase();
  const name = String(formData.get("company") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const requestedRole = String(formData.get("role") ?? "");

  if (!email) return { error: "Your account needs an email to join a company." };
  if (name.length < 3) return { error: "Type the company name (at least 3 letters)." };
  if (code.length !== 4) return { error: "Enter the 4-digit company code." };
  if (!OPEN_JOIN_ROLES.has(requestedRole)) return { error: "Pick a role to join as." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Join is not available in this environment." };
  }

  const { data: orgs, error: orgError } = await orgsTable(admin)
    .select("id, name, slug, join_code, subscription_tier, admin_seats, manager_seats, member_seats")
    .ilike("name", `%${name}%`)
    .eq("join_code", code)
    .limit(5);

  if (orgError) return { error: orgError.message };
  if (!orgs || orgs.length === 0) {
    return { error: "No company matched that name and code." };
  }
  if (orgs.length > 1) {
    return { error: "More than one company matched. Type more of the name." };
  }
  const org = orgs[0];

  if (isSoloAccountTier(org.subscription_tier)) {
    const { count } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id);
    if ((count ?? 0) >= 1) {
      return {
        error: `${org.name} is a Solo Owner account — it's single-seat and already has its one user.`,
      };
    }
  }

  const { data: existingMember } = await admin
    .from("organization_members")
    .select("id")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existingMember) {
    const { error: memberError } = await admin.from("organization_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "member",
    });
    if (memberError && memberError.code !== "23505") {
      return { error: memberError.message };
    }
  }

  const roleRequestsTable = (
    admin as unknown as {
      from: (t: string) => {
        upsert: (
          row: Record<string, unknown>,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  ).from("role_join_requests");
  const { error: reqError } = await roleRequestsTable.upsert(
    { org_id: org.id, user_id: user.id, email, requested_role: requestedRole, status: "pending" },
    { onConflict: "org_id,user_id,requested_role" },
  );
  if (reqError) return { error: reqError.message };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, org.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/settings");
  redirect("/dashboard?mail=" + encodeURIComponent("You're in! An admin will confirm your role in Settings shortly."));
}

export async function approveRoleJoinRequest(formData: FormData) {
  const { role, activeOrg } = await requireActiveOrg();
  if (!canManageOrg(role)) return;
  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const requestedRole = String(formData.get("requestedRole") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const slot = String(formData.get("slot") ?? "");
  if (!id || !userId) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  if (requestedRole === "manager") {
    await admin
      .from("organization_members")
      .update({ role: "manager" })
      .eq("org_id", activeOrg.id)
      .eq("user_id", userId);
  } else if (requestedRole === "permit_tech" || requestedRole === "hoa_tech") {
    // Approving a tech request is what actually assigns the preset slot
    // (organization_members.permit_tech_label / hoa_tech_label) — the same
    // columns "My tech identity" writes to, so the dashboard's "My Jobs"
    // view works immediately without the person having to visit Settings
    // themselves. The admin picks the slot on the approve form since two
    // people can't share one.
    const validSlots =
      requestedRole === "permit_tech"
        ? permitTechSlots(activeOrg.permit_tech_seats)
        : hoaTechSlots(activeOrg.hoa_tech_seats);
    if (validSlots.includes(slot)) {
      const column = requestedRole === "permit_tech" ? "permit_tech_label" : "hoa_tech_label";
      const orgMembersTable = (
        admin as unknown as {
          from: (t: string) => {
            update: (row: Record<string, unknown>) => {
              eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
            };
          };
        }
      ).from("organization_members");
      await orgMembersTable.update({ [column]: slot }).eq("org_id", activeOrg.id).eq("user_id", userId);
    }
  } else if (INSTALL_ROLES.has(requestedRole)) {
    // Install-role permissions read from install_members, not
    // organization_members.role — approving here is what actually creates
    // (or claims) that roster row for the signed-in person.
    const installTable = (
      admin as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => {
                eq: (c: string, v: string) => {
                  maybeSingle: () => Promise<{ data: { id: string } | null }>;
                };
              };
            };
          };
          update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
          insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
        };
      }
    ).from("install_members");

    const { data: existing } = await installTable
      .select("id")
      .eq("org_id", activeOrg.id)
      .eq("email", email)
      .eq("role", requestedRole)
      .maybeSingle();

    if (existing) {
      await installTable.update({ user_id: userId }).eq("id", existing.id);
    } else {
      await installTable.insert({ org_id: activeOrg.id, email, user_id: userId, role: requestedRole });
    }
    revalidatePath("/install");
  } else if (RUNNER_ROLES.has(requestedRole)) {
    // Runner permissions read from runner_members, not
    // organization_members.role — approving here is what actually creates
    // (or claims) that roster row for the signed-in person. Unlike install,
    // runner_members has no role column (there's only one role in this
    // module), so it's keyed on (org_id, email) alone.
    const runnerTable = (
      admin as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => {
                maybeSingle: () => Promise<{ data: { id: string } | null }>;
              };
            };
          };
          update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
          insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
        };
      }
    ).from("runner_members");

    const { data: existing } = await runnerTable
      .select("id")
      .eq("org_id", activeOrg.id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      await runnerTable.update({ user_id: userId }).eq("id", existing.id);
    } else {
      await runnerTable.insert({ org_id: activeOrg.id, email, user_id: userId });
    }
    revalidatePath("/runner");
  } else if (SERVICE_ROLES.has(requestedRole)) {
    const serviceTable = (
      admin as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => {
                eq: (c: string, v: string) => {
                  maybeSingle: () => Promise<{ data: { id: string } | null }>;
                };
              };
            };
          };
          update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
          insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
        };
      }
    ).from("service_members");

    const { data: existing } = await serviceTable
      .select("id")
      .eq("org_id", activeOrg.id)
      .eq("email", email)
      .eq("role", requestedRole)
      .maybeSingle();

    if (existing) {
      await serviceTable.update({ user_id: userId }).eq("id", existing.id);
    } else {
      await serviceTable.insert({ org_id: activeOrg.id, email, user_id: userId, role: requestedRole });
    }
    revalidatePath("/service");
  }

  type RoleRequestsTable = {
    update: (vals: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } };
  };
  const roleRequestsTable = (admin as unknown as { from: (t: string) => RoleRequestsTable }).from("role_join_requests");
  await roleRequestsTable
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", activeOrg.id);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function denyRoleJoinRequest(formData: FormData) {
  const { role, activeOrg } = await requireActiveOrg();
  if (!canManageOrg(role)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  type RoleRequestsTable = {
    update: (vals: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } };
  };
  const roleRequestsTable = (admin as unknown as { from: (t: string) => RoleRequestsTable }).from("role_join_requests");
  await roleRequestsTable.update({ status: "denied" }).eq("id", id).eq("org_id", activeOrg.id);

  revalidatePath("/settings");
}

type RosterHit = { table: "install_members" | "service_members" | "runner_members"; dest: string };

async function rosterHits(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  email: string,
): Promise<RosterHit[]> {
  const table = admin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          ilike: (c: string, d: string) => Promise<{ data: { id: string }[] | null }>;
        };
      };
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => { ilike: (c: string, d: string) => Promise<{ error: unknown }> };
      };
    };
  };
  const hits: RosterHit[] = [];
  const install = await table.from("install_members").select("id").eq("org_id", orgId).ilike("email", email);
  if ((install.data ?? []).length > 0) hits.push({ table: "install_members", dest: "/install" });
  const service = await table.from("service_members").select("id").eq("org_id", orgId).ilike("email", email);
  if ((service.data ?? []).length > 0) hits.push({ table: "service_members", dest: "/service" });
  const runner = await table.from("runner_members").select("id").eq("org_id", orgId).ilike("email", email);
  if ((runner.data ?? []).length > 0) hits.push({ table: "runner_members", dest: "/runner" });
  return hits;
}

/**
 * Owner assigned the role in Settings first. New person enters company
 * name + join code + email + password. No role picker. Their email has
 * to already be on an invite or a roster (install / service / runner).
 */
export async function joinAssigned(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const company = String(formData.get("company") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (company.length < 3) return { error: "Type the company name (at least 3 letters)." };
  if (code.length !== 4) return { error: "Enter the 4-digit company code." };
  if (!email || !email.includes("@")) return { error: "Enter the email your manager put on your role." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords don't match." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Join is not available in this environment." };
  }

  const { data: orgs, error: orgError } = await orgsTable(admin)
    .select("id, name, slug, join_code, subscription_tier, admin_seats, manager_seats, member_seats")
    .ilike("name", `%${company}%`)
    .eq("join_code", code)
    .limit(5);

  if (orgError) return { error: orgError.message };
  if (!orgs || orgs.length === 0) return { error: "No company matched that name and code." };
  if (orgs.length > 1) return { error: "More than one company matched. Type more of the name." };
  const org = orgs[0];

  const hits = await rosterHits(admin, org.id, email);

  let assigned: { role: string; tech_slot: string | null } | null = null;
  try {
    const assignedTable = admin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (a: string, b: string) => {
            ilike: (c: string, d: string) => {
              maybeSingle: () => Promise<{ data: { role: string; tech_slot: string | null } | null }>;
            };
          };
        };
      };
    };
    const { data } = await assignedTable
      .from("assigned_roles")
      .select("role, tech_slot")
      .eq("org_id", org.id)
      .ilike("email", email)
      .maybeSingle();
    assigned = data;
  } catch {
    assigned = null;
  }

  const { data: invite } = await admin
    .from("organization_invites")
    .select("id, role, accepted_at, revoked_at, expires_at")
    .eq("org_id", org.id)
    .ilike("email", email)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const openInvite = invite && !invite.accepted_at ? invite : null;
  if (openInvite?.expires_at && new Date(openInvite.expires_at).getTime() < Date.now()) {
    return { error: "That invite expired. Ask your manager to assign you again." };
  }
  if (hits.length === 0 && !openInvite && !assigned) {
    return {
      error: `This email is not assigned at ${org.name} yet. Ask your manager to add you in Settings first.`,
    };
  }

  const supabase = await createClient();
  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) {
      const already = createError.message?.toLowerCase().includes("already") ?? false;
      if (already) {
        return {
          error: "That email already has a PermitAIO account. Sign in, or use Forgot password.",
        };
      }
      return { error: createError.message };
    }
    const again = await supabase.auth.signInWithPassword({ email, password });
    if (again.error) {
      return { error: "Account created — sign in at the login page, then come back here." };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Could not start your session. Try signing in." };

  const orgRole =
    openInvite?.role && ROLE_SEAT_COLUMN[openInvite.role]
      ? openInvite.role
      : assigned?.role && ROLE_SEAT_COLUMN[assigned.role]
        ? assigned.role
        : "member";
  const { error: memberError } = await admin.from("organization_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: orgRole,
  });
  if (memberError && memberError.code !== "23505") {
    return { error: memberError.message };
  }

  if (assigned?.role === "permit_tech" && assigned.tech_slot) {
    await admin
      .from("organization_members")
      .update({ permit_tech_label: assigned.tech_slot } as never)
      .eq("org_id", org.id)
      .eq("user_id", user.id);
  }
  if (assigned?.role === "hoa_tech" && assigned.tech_slot) {
    await admin
      .from("organization_members")
      .update({ hoa_tech_label: assigned.tech_slot } as never)
      .eq("org_id", org.id)
      .eq("user_id", user.id);
  }

  const linker = admin as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => { ilike: (c: string, d: string) => Promise<{ error: unknown }> };
      };
    };
  };
  for (const hit of hits) {
    await linker.from(hit.table).update({ user_id: user.id }).eq("org_id", org.id).ilike("email", email);
  }

  if (openInvite) {
    await admin
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", openInvite.id);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, org.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  const dest =
    (assigned?.role ? ASSIGNED_DEST[assigned.role] : undefined) ?? hits[0]?.dest ?? "/dashboard";
  revalidatePath("/dashboard");
  revalidatePath(dest);
  redirect(dest);
}
