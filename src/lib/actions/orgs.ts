"use server";

import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/data/orgs";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { ActionResult } from "./auth";
import { notifySignup } from "@/lib/email/notify-signup";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "org"
  );
}

/** Creates a new organization. The `handle_new_organization` DB trigger
 * (SECURITY DEFINER) makes the current user its Owner and seeds the org
 * with default stages and the generic HOA / product-approval /
 * requirements-form template data. */
export async function createOrg(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter a company name." };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect("/login");
  }

  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, slug })
    .select("id, slug")
    .single();

  if (orgError || !org) {
    return { error: orgError?.message ?? "Couldn't create the organization." };
  }

  // Membership (as Owner), default stage seeding, and reference-data
  // seeding (HOAs / product approvals / requirements forms) all happen
  // automatically inside the `handle_new_organization` trigger that fires
  // on this insert — no follow-up client calls needed here.

  // Best-effort notification to the platform owner. Never blocks signup.
  try {
    await notifySignup({
      orgName: name,
      orgSlug: org.slug,
      userEmail: userData?.user?.email ?? null,
    });
  } catch (err) {
    console.error("createOrg: notifySignup threw unexpectedly", err);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, org.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}

/** Switches the active org for the current session (updates the cookie). */
export async function switchOrg(slug: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
