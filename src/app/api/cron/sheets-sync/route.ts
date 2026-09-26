import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSheetSync } from "@/lib/agents/sheet-sync/sync";

/**
 * Scheduled sync between every connected org's Google Sheet(s) and
 * PermitAIO, invoked 3x/day by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Fails closed, same pattern as dynamics365-sync and gmail-check: a
 * missing CRON_SECRET is a misconfiguration, not an open endpoint — this
 * route writes real job data, so it must never be callable without the
 * secret.
 *
 * Connections are grouped by org and, within an org, sorted by `priority`
 * descending so the lowest-priority-number (highest-authority) connection
 * for that org syncs LAST in this run — if two sheets map the same field
 * for the same job, the higher-authority one's write is the one left
 * standing. A failure on one connection is caught and recorded on that
 * connection alone; it never blocks the rest of the run.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: connections, error: connectionsError } = await (
    admin as unknown as { from: (t: string) => any }
  )
    .from("sheet_connections")
    .select("id, org_id, priority")
    .eq("status", "active");

  if (connectionsError) {
    return NextResponse.json({ error: "Failed to load sheet connections." }, { status: 500 });
  }

  const byOrg = new Map<string, { id: string; priority: number }[]>();
  for (const c of connections ?? []) {
    const list = byOrg.get(c.org_id) ?? [];
    list.push({ id: c.id, priority: c.priority });
    byOrg.set(c.org_id, list);
  }

  const summary: Record<string, unknown>[] = [];

  for (const [orgId, orgConnections] of byOrg) {
    orgConnections.sort((a, b) => b.priority - a.priority); // highest-authority (lowest number) runs last

    for (const { id } of orgConnections) {
      try {
        const result = await runSheetSync(id, "cron", null);
        summary.push({ org_id: orgId, connection_id: id, ...result });
      } catch (err) {
        summary.push({
          org_id: orgId,
          connection_id: id,
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return NextResponse.json({ ok: true, connections: summary });
}
