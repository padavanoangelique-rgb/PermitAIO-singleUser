import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg, canManageOrg } from "@/lib/data/orgs";
import { SITE_URL } from "@/lib/site-config";

/**
 * QR shortcut onto /join/sales with this org's join code pre-filled —
 * self-serve, no invite needed, no company name required (the sales join
 * flow matches by code alone). Mirrors /api/install/join-qr and
 * /api/team/join-qr so every role has a scan-to-join option.
 */
export async function GET() {
  await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  if (!canManageOrg(role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const supabase = await createClient();
  const raw = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { join_code: string | null } | null }>;
        };
      };
    };
  };
  const { data } = await raw.from("organizations").select("join_code").eq("id", activeOrg.id).maybeSingle();
  const joinCode = data?.join_code;
  if (!joinCode) {
    return NextResponse.json({ error: "Set a join code in Settings first." }, { status: 404 });
  }

  const url = `${SITE_URL}/join/sales?code=${encodeURIComponent(joinCode)}`;
  const png = await QRCode.toBuffer(url, { type: "png", width: 480, margin: 2 });

  return new NextResponse(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
    },
  });
}
