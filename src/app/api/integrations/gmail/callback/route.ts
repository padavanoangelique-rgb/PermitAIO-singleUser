import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  getGmailProfile,
  verifyOAuthState,
  revokeToken,
} from "@/lib/gmail/oauth";
import { upsertGmailConnection } from "@/lib/gmail/db";

const AUTHORIZED_MAILBOX = process.env.EMAIL_AGENT_MAILBOX || "agent@permitaio.com";

/**
 * Google redirects here after the mailbox owner approves (or denies)
 * access. Exchanges the code for tokens, then — critically — verifies the
 * resulting account is exactly AUTHORIZED_MAILBOX via two independent
 * identity checks (OAuth userinfo AND the Gmail profile itself) before
 * storing anything. If a different account authorized (e.g. someone's
 * personal Gmail, or hello@permitaio.com), the tokens are revoked
 * immediately and nothing is persisted.
 *
 * Every exit path — success, OAuth error, missing/invalid state, nonce
 * mismatch, wrong account, missing refresh token, or an exchange failure —
 * clears the gmail_oauth_nonce cookie, since toAdmin() does that itself
 * rather than leaving each branch to remember to.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const toAdmin = (query: string) => {
    const response = NextResponse.redirect(`${origin}/admin/email-agent?${query}`);
    response.cookies.delete("gmail_oauth_nonce");
    return response;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  if (errorParam) {
    return toAdmin(`gmail=error&reason=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return toAdmin("gmail=error&reason=missing_code");
  }

  const parsedState = verifyOAuthState(state);
  if (!parsedState) {
    return toAdmin("gmail=error&reason=bad_state");
  }

  const nonceCookie = request.cookies.get("gmail_oauth_nonce")?.value;
  if (!nonceCookie || nonceCookie !== parsedState.nonce) {
    return toAdmin("gmail=error&reason=nonce_mismatch");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    if (userInfo.email.toLowerCase() !== AUTHORIZED_MAILBOX.toLowerCase()) {
      // Wrong account authorized — revoke immediately, store nothing, and
      // make sure any prior connection isn't left looking active.
      await revokeToken(tokens.access_token).catch(() => {});
      if (tokens.refresh_token) {
        await revokeToken(tokens.refresh_token).catch(() => {});
      }
      return toAdmin(
        `gmail=error&reason=wrong_account&got=${encodeURIComponent(userInfo.email)}`,
      );
    }

    // Second, independent identity check against the Gmail profile itself
    // (not just the OAuth userinfo endpoint) — belt and suspenders against
    // the two ever disagreeing about which mailbox this token grants access to.
    const gmailProfile = await getGmailProfile(tokens.access_token);
    if (gmailProfile.emailAddress.toLowerCase() !== AUTHORIZED_MAILBOX.toLowerCase()) {
      await revokeToken(tokens.access_token).catch(() => {});
      if (tokens.refresh_token) {
        await revokeToken(tokens.refresh_token).catch(() => {});
      }
      return toAdmin(
        `gmail=error&reason=wrong_account&got=${encodeURIComponent(gmailProfile.emailAddress)}`,
      );
    }

    if (!tokens.refresh_token) {
      // Google omits refresh_token on re-consent unless prompt=consent forced
      // it — we always send prompt=consent, but guard anyway rather than
      // silently storing a connection that can't survive an access-token
      // expiry.
      return toAdmin("gmail=error&reason=no_refresh_token");
    }

    await upsertGmailConnection({
      googleEmail: userInfo.email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      grantedScopes: tokens.scope.split(" ").filter(Boolean),
      status: "connected",
    });

    return toAdmin("gmail=connected");
  } catch (err) {
    console.error("Gmail OAuth callback failed:", err);
    return toAdmin("gmail=error&reason=token_exchange_failed");
  }
}
