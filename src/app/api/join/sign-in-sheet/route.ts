import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg, canManageOrg } from "@/lib/data/orgs";
import { SITE_URL } from "@/lib/site-config";
import { buildSignInSheetPdf } from "@/lib/join/sign-in-sheet-pdf";

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
  const joinCode = data?.join_code ?? null;
  const joinUrl = joinCode
    ? `${SITE_URL}/join?company=${encodeURIComponent(activeOrg.name)}&code=${encodeURIComponent(joinCode)}`
    : `${SITE_URL}/join`;

  const pdf = await buildSignInSheetPdf({
    companyName: activeOrg.name,
    joinCode,
    joinUrl,
  });

  const slug = activeOrg.slug.replace(/[^a-z0-9-]/gi, "") || "company";
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}-sign-in.pdf"`,
    },
  });
}
