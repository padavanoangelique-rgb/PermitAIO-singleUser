"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_ORG_COOKIE } from "@/lib/data/orgs";
import type { ActionResult } from "./auth";

function normalizeCode(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 4);
}

function orgsByCode(admin: ReturnType<typeof createAdminClient>) {
  return admin.from("organizations") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { id: string; slug: string; name: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

async function attachToOrgByCode(userId: string, code: string): Promise<ActionResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Join is not available in this environment." };
  }

  const { data: org, error: orgError } = await orgsByCode(admin)
    .select("id, slug, name")
    .eq("join_code", code)
    .maybeSingle();
  if (orgError) return { error: orgError.message };
  if (!org) return { error: "No company matches that join code." };

  const { error: memberError } = await admin.from("organization_members").insert({
    org_id: org.id,
    user_id: userId,
    role: "member",
  });
  if (memberError && memberError.code !== "23505") {
    return { error: memberError.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, org.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/sales");
}

// Self-serve: email + company join code + a password they pick, all in one
// step. No pre-created invite and no seat cap — sales reps join freely with
// just the code, unlike the install roster flow which requires a manager to
// have added their email first.
export async function salesSelfServeJoin(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const code = normalizeCode(String(formData.get("code") ?? ""));

  if (!email || !password) return { error: "Enter your email and password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords don't match." };
  if (code.length !== 4) return { error: "Enter the 4-digit company join code." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Join is not available in this environment." };
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    const alreadyRegistered = createError.message?.toLowerCase().includes("already") ?? false;
    if (alreadyRegistered) {
      return { error: "An account with that email already exists. Sign in, then come back to this page." };
    }
    return { error: createError.message };
  }

  const supabase = await createClient();
  const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.user) {
    return { error: "Account created — sign in, then come back to this page to finish joining." };
  }

  return attachToOrgByCode(signInData.user.id, code);
}

// For someone who already has a PermitAIO account: just the join code.
export async function salesJoinWithCode(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first, then come back to this page." };

  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (code.length !== 4) return { error: "Enter the 4-digit company join code." };

  return attachToOrgByCode(user.id, code);
}
