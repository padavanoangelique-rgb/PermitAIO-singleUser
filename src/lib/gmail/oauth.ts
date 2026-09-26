// Gmail OAuth 2.0 helpers for the PermitAIO Email Agent.
//
// Authorized for exactly one mailbox: agent@permitaio.com (EMAIL_AGENT_MAILBOX).
// Scopes are intentionally narrow — openid, email, and gmail.modify (label
// management + read) — never https://mail.google.com/, never Drive/Calendar/
// Contacts, never domain-wide delegation. All token exchange happens here,
// server-side only; nothing in this file is ever imported by client code.
import "server-only";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_PROFILE_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.modify",
] as const;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// OAuth state — signed so a party who doesn't hold GOOGLE_GMAIL_CLIENT_SECRET
// can't forge a callback (CSRF). Paired with a short-lived nonce cookie set
// by the /connect route and checked by /callback, same pattern as the
// Dynamics 365 CRM integration's signOAuthState/verifyOAuthState.
// ---------------------------------------------------------------------------

export interface OAuthState {
  nonce: string;
}

export function createOAuthNonce(): string {
  return randomBytes(16).toString("hex");
}

export function signOAuthState(state: OAuthState): string {
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", getEnv("GOOGLE_GMAIL_CLIENT_SECRET"))
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthState | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", getEnv("GOOGLE_GMAIL_CLIENT_SECRET"))
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
    client_id: getEnv("GOOGLE_GMAIL_CLIENT_ID"),
    redirect_uri: getEnv("GOOGLE_GMAIL_REDIRECT_URI"),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
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
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: getEnv("GOOGLE_GMAIL_CLIENT_ID"),
    client_secret: getEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
    redirect_uri: getEnv("GOOGLE_GMAIL_REDIRECT_URI"),
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
    client_id: getEnv("GOOGLE_GMAIL_CLIENT_ID"),
    client_secret: getEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
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

export interface GmailProfile {
  emailAddress: string;
  historyId: string;
  messagesTotal: number;
  threadsTotal: number;
}

export async function getGmailProfile(accessToken: string): Promise<GmailProfile> {
  const res = await fetch(GMAIL_PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail profile request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}
