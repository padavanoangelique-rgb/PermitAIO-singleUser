// Google OAuth 2.0 helpers for the Reports Agent's read-only Sheets access.
//
// Unlike src/lib/gmail/oauth.ts (locked to exactly one PermitAIO-owned
// mailbox), this module accepts ANY Google account — each contractor's
// sheet is owned by their own account, not PermitAIO's. The org being set
// up is carried through the signed OAuth state instead, the same way
// src/lib/crm/dynamics365.ts carries orgId through its own state for the
// exact same reason (an external party's own credential, not a fixed one).
//
// Scope is intentionally read-only and narrow: spreadsheets.readonly only —
// never write, never Drive-wide, never domain-wide delegation.
import "server-only";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

export const SHEETS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
] as const;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

export interface OAuthState {
  orgId: string;
  nonce: string;
}

export function createOAuthNonce(): string {
  return randomBytes(16).toString("hex");
}

export function signOAuthState(state: OAuthState): string {
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", getEnv("GOOGLE_SHEETS_CLIENT_SECRET"))
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthState | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", getEnv("GOOGLE_SHEETS_CLIENT_SECRET"))
    .update(encoded)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return null;
  }
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getEnv("GOOGLE_SHEETS_CLIENT_ID"),
    redirect_uri: getEnv("GOOGLE_SHEETS_REDIRECT_URI"),
    response_type: "code",
    scope: SHEETS_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: getEnv("GOOGLE_SHEETS_CLIENT_ID"),
    client_secret: getEnv("GOOGLE_SHEETS_CLIENT_SECRET"),
    redirect_uri: getEnv("GOOGLE_SHEETS_REDIRECT_URI"),
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export interface RefreshedToken {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function refreshAccessToken(refreshToken: string): Promise<RefreshedToken> {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: getEnv("GOOGLE_SHEETS_CLIENT_ID"),
    client_secret: getEnv("GOOGLE_SHEETS_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function revokeToken(token: string): Promise<void> {
  const params = new URLSearchParams({ token });
  const res = await fetch(GOOGLE_REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok && res.status !== 400) {
    throw new Error(`Google token revoke failed (${res.status}): ${await res.text()}`);
  }
}

export interface GoogleUserInfo {
  email: string;
  verified_email: boolean;
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}
