"use server";

import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionTiers, soloOwnerTier } from "@/lib/marketing/pricing";
import type { Database } from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";

type OrganizationUpdate = Database["public"]["Tables"]["organizations"]["Update"];

export interface PlatformTrialResult {
  error: string | null;
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/trials");
}

/** Extends an org's trial by N days from whichever is later: today, or its
 * current trial_ends_at (so re-extending an already-active trial adds on
 * top of it instead of shortening it). Flips subscription_status back to
 * 'trialing' first if the org isn't already trialing (e.g. reviving a
 * canceled org). */
export async function extendOrgTrial(orgId: string, days: 14 | 30 | 60): Promise<PlatformTrialResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data: org, error: fetchError } = await admin
    .from("organizations")
    .select("trial_ends_at, subscription_status")
    .eq("id", orgId)
    .maybeSingle();
  if (fetchError || !org) return { error: "Org not found." };

  const now = new Date();
  const currentEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const base = currentEnd && currentEnd > now ? currentEnd : now;
  const nextTrialEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const patch: OrganizationUpdate = { trial_ends_at: nextTrialEnd.toISOString() };
  if (org.subscription_status !== "trialing") patch.subscription_status = "trialing";

  const { error } = await admin.from("organizations").update(patch).eq("id", orgId);
  if (error) return { error: error.message };
  revalidateAdmin();
  return { error: null };
}

/** Marks an org as complimentary (free forever) — clears trial_ends_at
 * since a comped org isn't on a countdown anymore. Does not touch Stripe;
 * this only affects our own subscription_status gate. */
export async function compOrg(orgId: string): Promise<PlatformTrialResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ subscription_status: "comped", trial_ends_at: null })
    .eq("id", orgId);
  if (error) return { error: error.message };
  revalidateAdmin();
  return { error: null };
}

/** Reverts a comped org back to a fresh 14-day trial. */
export async function uncompOrg(orgId: string): Promise<PlatformTrialResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("organizations")
    .update({ subscription_status: "trialing", trial_ends_at: trialEnd })
    .eq("id", orgId);
  if (error) return { error: error.message };
  revalidateAdmin();
  return { error: null };
}

/** Marks an org's subscription canceled on our side. Does NOT cancel the
 * Stripe subscription itself — the caller still has to do that in Stripe
 * (or the org's own /billing page) if a live subscription exists. */
export async function cancelOrgSubscription(orgId: string): Promise<PlatformTrialResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ subscription_status: "canceled" })
    .eq("id", orgId);
  if (error) return { error: error.message };
  revalidateAdmin();
  return { error: null };
}

const VALID_SUBSCRIPTION_TIERS = new Set<string>([
  ...subscriptionTiers.map((t) => t.id),
  soloOwnerTier.id,
]);

/** The one control that sets or changes an org's account type — used both
 * to set it during onboarding and to change it later (e.g. upgrading an
 * org off Solo Owner onto a team plan). */
export async function setOrgSubscriptionTier(orgId: string, tier: string): Promise<PlatformTrialResult> {
  await requirePlatformAdmin();
  if (!VALID_SUBSCRIPTION_TIERS.has(tier)) return { error: "Not a valid account type." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ subscription_tier: tier })
    .eq("id", orgId);
  if (error) return { error: error.message };
  revalidateAdmin();
  return { error: null };
}
