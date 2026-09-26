import { NextRequest, NextResponse } from "next/server";

/**
 * Stub for the future Gmail Pub/Sub push architecture — NOT wired up yet.
 * v1 of the Email Agent uses /api/cron/gmail-check (polling) instead; see
 * src/lib/gmail/watch.ts for the setup steps this route will need once a
 * Pub/Sub topic exists.
 *
 * When enabled, this receives a Pub/Sub push message shaped like:
 *   { message: { data: "<base64 JSON {emailAddress, historyId}>", ... } }
 * and should call listHistorySinceId() (src/lib/gmail/labels.ts) with the
 * decoded historyId, the same incremental-sync path the polling cron uses —
 * intentionally kept identical so both entry points feed the same safe-mode
 * label-only logic.
 *
 * Left disabled (410) rather than silently accepting and no-op'ing: an
 * unconfigured push subscription pointed here should fail loudly instead of
 * looking like it's working.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "Gmail push webhook is not enabled yet — v1 uses /api/cron/gmail-check polling." },
    { status: 410 },
  );
}
