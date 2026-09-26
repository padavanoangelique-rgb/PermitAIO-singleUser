import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

/** Removes one sheet connection only — the underlying Google account grant
 * (sheet_oauth_grants) stays, since the same account may back other
 * connections for this org. */
export async function POST(request: NextRequest) {
  await requireUser();
  await requirePlatformAdmin();

  const { connectionId } = (await request.json()) as { connectionId?: string };
  if (!connectionId) {
    return NextResponse.json({ error: "Missing connectionId." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await adminTable(admin, "sheet_connections").delete().eq("id", connectionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
