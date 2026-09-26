import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "@/lib/gmail/crypto";

// sheet_oauth_grants / sheet_connections aren't in the generated Database
// type yet — cast until `supabase gen types typescript` is re-run (same
// pattern used throughout for crm_connections / gmail_connections).
function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

export interface SheetOAuthGrantRow {
  id: string;
  org_id: string;
  google_email: string;
  scope: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  access_token_expires_at: string;
  status: "connected" | "revoked" | "error";
  last_error: string | null;
}

export async function getGrantForOrg(orgId: string): Promise<SheetOAuthGrantRow | null> {
  const admin = createAdminClient();
  const { data, error } = await adminTable(admin, "sheet_oauth_grants")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as SheetOAuthGrantRow | null;
}

export async function getGrantById(grantId: string): Promise<SheetOAuthGrantRow | null> {
  const admin = createAdminClient();
  const { data, error } = await adminTable(admin, "sheet_oauth_grants")
    .select("*")
    .eq("id", grantId)
    .maybeSingle();
  if (error) throw error;
  return data as SheetOAuthGrantRow | null;
}

export async function upsertGrant(input: {
  orgId: string;
  googleEmail: string;
  scope: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  grantedBy: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await adminTable(admin, "sheet_oauth_grants").upsert(
    {
      org_id: input.orgId,
      google_email: input.googleEmail,
      scope: input.scope,
      refresh_token_encrypted: encryptToken(input.refreshToken),
      access_token_encrypted: encryptToken(input.accessToken),
      access_token_expires_at: input.accessTokenExpiresAt,
      status: "connected",
      last_error: null,
      granted_by: input.grantedBy,
    },
    { onConflict: "org_id,google_email" },
  );
  if (error) throw error;
}

export async function markGrantError(grantId: string, message: string): Promise<void> {
  const admin = createAdminClient();
  await adminTable(admin, "sheet_oauth_grants")
    .update({ status: "error", last_error: message })
    .eq("id", grantId);
}

/**
 * Returns a valid access token for this grant, refreshing it first if it's
 * expired or about to expire. Returns null (and marks the grant errored) if
 * the refresh itself fails.
 */
export async function getValidAccessToken(grantId: string): Promise<string | null> {
  const { refreshAccessToken } = await import("./oauth");
  const grant = await getGrantById(grantId);
  if (!grant || grant.status !== "connected") return null;

  const expiresAt = new Date(grant.access_token_expires_at).getTime();
  const needsRefresh = expiresAt - Date.now() < 60_000;

  if (!needsRefresh) {
    return decryptToken(grant.access_token_encrypted);
  }

  try {
    const refreshToken = decryptToken(grant.refresh_token_encrypted);
    const refreshed = await refreshAccessToken(refreshToken);
    const admin = createAdminClient();
    await adminTable(admin, "sheet_oauth_grants")
      .update({
        access_token_encrypted: encryptToken(refreshed.access_token),
        access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        status: "connected",
        last_error: null,
      })
      .eq("id", grantId);
    return refreshed.access_token;
  } catch (err) {
    await markGrantError(grantId, err instanceof Error ? err.message : "Token refresh failed");
    return null;
  }
}
