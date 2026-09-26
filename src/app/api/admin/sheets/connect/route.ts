import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { buildAuthUrl, createOAuthNonce, signOAuthState } from "@/lib/sheets/oauth";

/**
 * Starts the Sheets OAuth flow for a specific org, picked by the platform
 * admin on /admin/sheets — unlike the Gmail Email Agent's connect route,
 * there's no fixed authorized account here: the contractor's own Google
 * account grants read-only access to their own spreadsheet.
 */
export async function GET(request: NextRequest) {
  await requireUser();
  await requirePlatformAdmin();

  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId." }, { status: 400 });
  }

  const nonce = createOAuthNonce();
  const state = signOAuthState({ orgId, nonce });
  const authUrl = buildAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("sheets_oauth_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
