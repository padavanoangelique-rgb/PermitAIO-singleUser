import { NextRequest, NextResponse } from "next/server";
import { runPermitScoutAll } from "@/lib/agents/permit-scout/run";

/** Twice a day. Public building-department search only. No mailbox access. */
export const maxDuration = 300; export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await runPermitScoutAll(20);
    return NextResponse.json(result);
  } catch (err) {
    console.error("permit scout cron failed", err);
    return NextResponse.json({ error: "Permit Scout run failed." }, { status: 500 });
  }
}
