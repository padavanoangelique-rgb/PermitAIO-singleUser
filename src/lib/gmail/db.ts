import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "./crypto";

// gmail_connections / gmail_processed_messages aren't in the generated
// Database type yet — cast until `supabase gen types typescript` is re-run
// (same pattern the Dynamics 365 CRM integration uses for crm_connections).
function gmailTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

export interface GmailConnectionRow {
  id: string;
  google_email: string;
  refresh_token_encrypted: string | null;
  access_token_encrypted: string | null;
  access_token_expires_at: string | null;
  granted_scopes: string[];
  gmail_history_id: string | null;
  status: "connected" | "disconnected" | "error";
  last_error: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

/** There is at most one row — this is a single platform-level connection. */
export async function getGmailConnection(): Promise<GmailConnectionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await gmailTable(supabase, "gmail_connections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GmailConnectionRow | null;
}

export async function getDecryptedRefreshToken(row: GmailConnectionRow): Promise<string | null> {
  if (!row.refresh_token_encrypted) return null;
  return decryptToken(row.refresh_token_encrypted);
}

export interface UpsertConnectionInput {
  googleEmail: string;
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: Date;
  grantedScopes: string[];
  status: "connected" | "disconnected" | "error";
  lastError?: string | null;
}

export async function upsertGmailConnection(input: UpsertConnectionInput) {
  const supabase = createAdminClient();
  const existing = await getGmailConnection();

  const payload: Record<string, unknown> = {
    google_email: input.googleEmail,
    granted_scopes: input.grantedScopes,
    status: input.status,
    last_error: input.lastError ?? null,
  };
  if (input.refreshToken) {
    payload.refresh_token_encrypted = encryptToken(input.refreshToken);
  }
  if (input.accessToken) {
    payload.access_token_encrypted = encryptToken(input.accessToken);
  }
  if (input.accessTokenExpiresAt) {
    payload.access_token_expires_at = input.accessTokenExpiresAt.toISOString();
  }
  if (input.status === "connected") {
    payload.connected_at = new Date().toISOString();
  }

  if (existing) {
    const { error } = await gmailTable(supabase, "gmail_connections").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await gmailTable(supabase, "gmail_connections").insert(payload);
    if (error) throw error;
  }
}

export async function updateGmailHistoryId(historyId: string) {
  const supabase = createAdminClient();
  const existing = await getGmailConnection();
  if (!existing) return;
  const { error } = await gmailTable(supabase, "gmail_connections")
    .update({ gmail_history_id: historyId })
    .eq("id", existing.id);
  if (error) throw error;
}

export async function markGmailDisconnected() {
  const supabase = createAdminClient();
  const existing = await getGmailConnection();
  if (!existing) return;
  const { error } = await gmailTable(supabase, "gmail_connections")
    .update({
      status: "disconnected",
      refresh_token_encrypted: null,
      access_token_encrypted: null,
      access_token_expires_at: null,
    })
    .eq("id", existing.id);
  if (error) throw error;
}

export async function markGmailError(message: string) {
  const supabase = createAdminClient();
  const existing = await getGmailConnection();
  if (!existing) return;
  const { error } = await gmailTable(supabase, "gmail_connections")
    .update({ status: "error", last_error: message })
    .eq("id", existing.id);
  if (error) throw error;
}

/** Dedup guard — returns true if this Gmail message has already been processed. */
export async function isMessageProcessed(gmailMessageId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await gmailTable(supabase, "gmail_processed_messages")
    .select("id")
    .eq("gmail_message_id", gmailMessageId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markMessageProcessed(gmailMessageId: string, gmailThreadId?: string) {
  const supabase = createAdminClient();
  const { error } = await gmailTable(supabase, "gmail_processed_messages")
    .insert({ gmail_message_id: gmailMessageId, gmail_thread_id: gmailThreadId ?? null })
    .select()
    .maybeSingle();
  // Unique-constraint violation just means another run already logged it — not an error for us.
  if (error && error.code !== "23505") throw error;
}

/**
 * Returns a valid access token for the connected mailbox, refreshing it
 * first if it's expired or about to expire. Returns null if not connected.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { refreshAccessToken } = await import("./oauth");
  const row = await getGmailConnection();
  if (!row || row.status !== "connected" || !row.refresh_token_encrypted) return null;

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at) : null;
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

  if (!needsRefresh && row.access_token_encrypted) {
    return decryptToken(row.access_token_encrypted);
  }

  const refreshToken = decryptToken(row.refresh_token_encrypted);
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    await upsertGmailConnection({
      googleEmail: row.google_email,
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      grantedScopes: row.granted_scopes,
      status: "connected",
    });
    return refreshed.access_token;
  } catch (err) {
    await markGmailError(err instanceof Error ? err.message : "Token refresh failed");
    return null;
  }
}
