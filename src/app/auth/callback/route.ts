import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / email-link callback handler.
 *
 * Supabase (and providers like Google) redirect the browser here with a
 * `code` query param after the user authenticates. We exchange that code
 * for a session (setting the auth cookies via the server client), then
 * send the user on to `next` — defaulting to `/onboarding`, which itself
 * redirects to `/dashboard` if the user already belongs to an organization.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "We couldn't complete sign-in. Please try again.",
      )}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Missing sign-in code.")}`,
  );
}
