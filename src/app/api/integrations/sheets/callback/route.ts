import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getGoogleUserInfo, verifyOAuthState } from "@/lib/sheets/oauth";
import { upsertGrant } from "@/lib/sheets/db";
import { requireUser } from "@/lib/data/orgs";

/**
 * Google redirects here after the contractor's Google account owner
 * approves (or denies) read-only access to their spreadsheets. No account
 * identity lock — any Google account the platform admin's flow was started
 * for is accepted and tied to that org_id (carried through the signed
 * state, verified below), not to a single fixed mailbox.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const toAdmin = (orgId: string | null, query: string) => {
    const suffix = orgId ? `org=${encodeURIComponent(orgId)}&${query}` : query;
    const response = NextResponse.redirect(`${origin}/admin/sheets?${suffix}`);
    response.cookies.delete("sheets_oauth_nonce");
    return response;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  if (errorParam) {
    return toAdmin(null, `sheets=error&reason=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return toAdmin(null, "sheets=error&reason=missing_code");
  }

  const parsedState = verifyOAuthState(state);
  if (!parsedState) {
    return toAdmin(null, "sheets=error&reason=bad_state");
  }

  const nonceCookie = request.cookies.get("sheets_oauth_nonce")?.value;
  if (!nonceCookie || nonceCookie !== parsedState.nonce) {
    return toAdmin(parsedState.orgId, "sheets=error&reason=nonce_mismatch");
  }

  const user = await requireUser();

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Google omits refresh_token on re-consent unless prompt=consent forced
      // it — we always send prompt=consent, but guard anyway.
      return toAdmin(parsedState.orgId, "sheets=error&reason=no_refresh_token");
    }

    const userInfo = await getGoogleUserInfo(tokens.access_token);

    await upsertGrant({
      orgId: parsedState.orgId,
      googleEmail: userInfo.email,
      scope: tokens.scope,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      grantedBy: user.id,
    });

    return toAdmin(parsedState.orgId, "sheets=connected");
  } catch (err) {
    console.error("Sheets OAuth callback failed:", err);
    return toAdmin(parsedState.orgId, "sheets=error&reason=token_exchange_failed");
  }
}
