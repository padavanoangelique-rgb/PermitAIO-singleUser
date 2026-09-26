import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForToken, verifyOAuthState } from "@/lib/crm/dynamics365";

/**
 * Microsoft redirects here after the org admin approves (or denies) access
 * to their Dynamics 365 tenant. Exchanges the auth code for tokens and
 * stores the connection — one row per (org, provider), so re-connecting
 * updates the same row rather than creating a duplicate.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const toSettings = (query: string) =>
    NextResponse.redirect(`${origin}/settings?${query}`);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  if (errorParam) {
    return toSettings(`d365=error&reason=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return toSettings("d365=error&reason=missing_code");
  }

  const parsedState = verifyOAuthState(state);
  if (!parsedState) {
    return toSettings("d365=error&reason=bad_state");
  }

  const nonceCookie = request.cookies.get("d365_oauth_nonce")?.value;
  if (!nonceCookie || nonceCookie !== parsedState.nonce) {
    return toSettings("d365=error&reason=nonce_mismatch");
  }

  const redirectUri =
    process.env.DYNAMICS_365_REDIRECT_URI ?? `${origin}/api/integrations/dynamics365/callback`;

  try {
    const tokens = await exchangeCodeForToken({
      code,
      redirectUri,
      environmentUrl: parsedState.environmentUrl,
    });

    const admin = createAdminClient();
    // crm_connections isn't in the generated Database type yet — cast until
    // `supabase gen types typescript` is re-run to include the new CRM
    // tables (same pattern the settings page already uses for `join_code`).
    const { error } = await (admin as unknown as { from: (t: string) => any })
      .from("crm_connections")
      .upsert(
        {
          org_id: parsedState.orgId,
          provider: "dynamics365",
          external_tenant_id: tokens.tenantId || parsedState.environmentUrl,
          environment_url: parsedState.environmentUrl,
          refresh_token: tokens.refreshToken,
          access_token: tokens.accessToken,
          access_token_expires_at: tokens.expiresAt,
          status: "active",
          last_error: null,
        },
        { onConflict: "org_id,provider" },
      );

    if (error) throw error;

    const response = toSettings("d365=connected");
    response.cookies.delete("d365_oauth_nonce");
    return response;
  } catch (err) {
    console.error("Dynamics 365 callback failed:", err);
    const response = toSettings("d365=error&reason=token_exchange_failed");
    response.cookies.delete("d365_oauth_nonce");
    return response;
  }
}
