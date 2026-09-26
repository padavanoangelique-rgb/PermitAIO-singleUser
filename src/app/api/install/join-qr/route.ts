import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg, canManageOrg } from "@/lib/data/orgs";
import { SITE_URL } from "@/lib/site-config";

/**
 * A scannable shortcut onto /join/install with this org's name and join
 * code pre-filled — the phone's own camera app opens the URL directly, no
 * in-app scanner needed. Only an owner/admin/manager can see the join
 * code itself (same gate Settings already uses for JoinCodeCard), so this
 * route enforces the same check rather than trusting the caller.
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

  const url = `${SITE_URL}/join/install?company=${encodeURIComponent(activeOrg.name)}&code=${encodeURIComponent(joinCode)}`;
  const png = await QRCode.toBuffer(url, { type: "png", width: 480, margin: 2 });

  return new NextResponse(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
    },
  });
}
