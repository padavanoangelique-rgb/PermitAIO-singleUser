import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { canManageOrg, type MemberRole } from "@/lib/data/orgs";
import { buildAuthorizeUrl, signOAuthState } from "@/lib/crm/dynamics365";

const ENVIRONMENT_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.crm\d*\.dynamics\.com$/i;

/**
 * Starts the Dynamics 365 connect flow for the caller's organization. Each
 * org supplies its own Dataverse environment URL (e.g.
 * https://contoso.crm.dynamics.com) — PermitAIO's Entra app registration is
 * multi-tenant, so the same flow connects any company's own Microsoft
 * tenant, not only PermitAIO's demo environment.
 */
export async function GET(request: NextRequest) {
  const environmentUrl = request.nextUrl.searchParams
    .get("environmentUrl")
    ?.trim()
    .replace(/\/+$/, "");

  if (!environmentUrl || !ENVIRONMENT_URL_PATTERN.test(environmentUrl)) {
    return NextResponse.json(
      { error: "Enter a valid Dynamics 365 environment URL, e.g. https://yourorg.crm.dynamics.com" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Route handlers can't rely on the cookie-based "active org" helper the
  // same way pages do (see billing/checkout) — resolve membership directly.
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("role, org_id")
    .eq("user_id", userData.user.id);

  if (membershipError || !memberships || memberships.length === 0) {
    return NextResponse.json({ error: "No organization found." }, { status: 404 });
  }

  const membership = memberships.find((m) => canManageOrg(m.role as MemberRole));
  if (!membership) {
    return NextResponse.json(
      { error: "Only an owner or admin can connect a CRM for this organization." },
      { status: 403 },
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const state = signOAuthState({ orgId: membership.org_id, environmentUrl, nonce });

  const origin = new URL(request.url).origin;
  const redirectUri =
    process.env.DYNAMICS_365_REDIRECT_URI ?? `${origin}/api/integrations/dynamics365/callback`;

  const response = NextResponse.redirect(
    buildAuthorizeUrl({ environmentUrl, redirectUri, state }),
  );
  response.cookies.set("d365_oauth_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
