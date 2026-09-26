import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { buildAuthUrl, createOAuthNonce, signOAuthState } from "@/lib/gmail/oauth";

/**
 * Starts the Gmail OAuth flow for the single authorized mailbox
 * (agent@permitaio.com). Platform-admin only — same gate as /admin.
 */
export async function GET(request: NextRequest) {
  await requireUser();
  await requirePlatformAdmin();

  const nonce = createOAuthNonce();
  const state = signOAuthState({ nonce });
  const authUrl = buildAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("gmail_oauth_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
