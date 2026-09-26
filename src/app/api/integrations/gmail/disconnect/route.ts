import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { getGmailConnection, markGmailDisconnected } from "@/lib/gmail/db";
import { revokeToken } from "@/lib/gmail/oauth";
import { decryptToken } from "@/lib/gmail/crypto";

export async function POST() {
  await requireUser();
  await requirePlatformAdmin();

  const connection = await getGmailConnection();
  if (connection?.refresh_token_encrypted) {
    try {
      await revokeToken(decryptToken(connection.refresh_token_encrypted));
    } catch (err) {
      console.error("Failed to revoke Gmail refresh token during disconnect:", err);
    }
  }

  await markGmailDisconnected();

  return NextResponse.json({ ok: true });
}
