import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { runSheetSync } from "@/lib/agents/sheet-sync/sync";

/** Manual "Sync now" trigger, calling the exact same engine the 3x/day cron
 * uses — see src/lib/agents/sheet-sync/sync.ts. */
export async function POST(request: NextRequest) {
  const user = await requireUser();
  await requirePlatformAdmin();

  const { connectionId } = (await request.json()) as { connectionId?: string };
  if (!connectionId) {
    return NextResponse.json({ error: "Missing connectionId." }, { status: 400 });
  }

  try {
    const result = await runSheetSync(connectionId, "manual", user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 },
    );
  }
}
