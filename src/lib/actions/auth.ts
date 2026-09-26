"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { redirect } from "next/navigation";

export type ActionResult =
  | { error: string; message?: undefined }
  | { error: null; message?: string };

export async function signIn(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Please confirm your email before signing in — check your inbox for the confirmation link.",
      };
    }
    return { error: "Incorrect email or password." };
  }

  // Platform admins always land in the Owner Console — never the org
  // dashboard and never the /onboarding "create a workspace" trap.
  // Honor an explicit ?next=/admin/... deep link if one is set.
  const admin = await isPlatformAdmin();
  if (admin) {
    const dest = next.startsWith("/admin") ? next : "/admin";
    redirect(dest);
  }

  redirect(next || "/dashboard");
}

export async function signUp(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  // Lets a caller (e.g. the install-team join page) send the new account
  // straight back to a specific next step instead of the default
  // "create a workspace" onboarding flow. Only honored when it's a
  // same-site path — never an absolute/external URL.
  const nextParam = String(formData.get("next") ?? "");
  const next = nextParam.startsWith("/") ? nextParam : "/onboarding";

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();

  // Create the account pre-confirmed via the Admin API instead of the
  // client-side signUp() call. Client-side signUp() makes Supabase Auth
  // send a confirmation email through its built-in mailer, which has a
  // very low, non-configurable rate limit absent a custom SMTP provider —
  // that limit is easy to exhaust and otherwise blocks every new signup
  // with a raw "email rate limit exceeded" error. Creating the user
  // pre-confirmed skips that email step entirely so self-serve signup
  // works regardless of email deliverability, then we sign them in
  // immediately to start their session.
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    // No SUPABASE_SERVICE_ROLE_KEY configured (e.g. local dev without it)
    // — fall back to the standard client flow, which may hit the email
    // rate limit but at least behaves correctly wherever the key exists.
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: error.message };
    }
    if (!data.session) {
      return {
        error: null,
        message:
          "Check your inbox to confirm your email, then sign in to finish setting up your organization.",
      };
    }
    redirect(next);
  }

  const { error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    const alreadyRegistered =
      createError.message?.toLowerCase().includes("already") ?? false;
    if (alreadyRegistered) {
      return {
        error: "An account with that email already exists. Try signing in instead.",
      };
    }
    return { error: createError.message };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    // Account was created successfully; sign-in hiccup just means they
    // land on /login instead of straight into onboarding.
    return {
      error: null,
      message: "Account created — sign in to finish setting up your organization.",
    };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Resolves the app's own origin from the incoming request headers rather
// than a hardcoded env var, so the reset link works correctly from
// preview deployments too, not just the production domain.
async function resolveOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  return host ? `${protocol}://${host}` : "https://permitaio.com";
}

export async function requestPasswordReset(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const origin = await resolveOrigin();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  // Same message whether or not an account exists for this email — don't
  // let this form be used to check which addresses have accounts.
  return {
    error: null,
    message:
      "If an account exists for that email, we've sent a link to reset your password.",
  };
}

export async function updatePassword(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();

  // updateUser() requires an active session — the /auth/callback route
  // establishes one by exchanging the reset link's code before sending
  // the user here. No session means the link was already used or expired.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      error: "Your password reset link has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
