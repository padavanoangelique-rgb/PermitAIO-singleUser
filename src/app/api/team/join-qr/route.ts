import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg, canManageOrg } from "@/lib/data/orgs";
import { SITE_URL } from "@/lib/site-config";

const VALID_ROLES = new Set(["permit_tech", "hoa_tech", "manager", "account_manager", "project_manager", "installer", "runner", "service_tech"]);

/**
 * QR shortcut onto /join/team with this org's name and join code
 * pre-filled — self-serve, no invite needed. `role` is optional: omit it
 * for the one generic "Scan to join" QR (the person picks their role
 * after signing in); pass it only for a legacy role-specific deep link.
 */
export async function GET(request: NextRequest) {
  await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  if (!canManageOrg(role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const roleParam = request.nextUrl.searchParams.get("role") ?? "";
  if (roleParam && !VALID_ROLES.has(roleParam)) {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
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

  let url = `${SITE_URL}/join/team?company=${encodeURIComponent(activeOrg.name)}&code=${encodeURIComponent(joinCode)}`;
  if (roleParam) url += `&role=${encodeURIComponent(roleParam)}`;
  const png = await QRCode.toBuffer(url, { type: "png", width: 480, margin: 2 });

  return new NextResponse(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
    },
  });
}
