import "server-only";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Production architecture (not wired in v1 — v1 uses /api/cron/gmail-check
 * polling instead). This module is the shape for the eventual push-based
 * flow:
 *
 *   Gmail -> Google Pub/Sub -> /api/webhooks/gmail -> Email Agent
 *            -> Job matcher -> Classification -> Needs Review / Recommended Action
 *
 * To enable it:
 *   1. Create a Pub/Sub topic in the same Google Cloud project as the OAuth
 *      client (e.g. `gmail-agent-push`).
 *   2. Grant Publish on that topic to the Gmail push service account:
 *      gmail-api-push@system.gserviceaccount.com
 *   3. Create a push subscription on that topic pointing at
 *      https://permitaio.com/api/webhooks/gmail
 *   4. Call startWatch() below (filtered to INBOX) once, then call it again
 *      before `expiration` on a schedule — a watch lasts at most 7 days.
 *   5. On each push, Gmail delivers only a historyId, not message content —
 *      the webhook still calls listHistorySinceId() (src/lib/gmail/labels.ts)
 *      to find what actually changed, same as the polling cron does.
 */

export interface WatchResult {
  historyId: string;
  /** Epoch millis (as a string, per the Gmail API) — renew before this. */
  expiration: string;
}

export async function startWatch(accessToken: string, pubsubTopic: string): Promise<WatchResult> {
  const res = await fetch(`${GMAIL_BASE}/watch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName: pubsubTopic,
      labelIds: ["INBOX"],
      labelFilterAction: "include",
    }),
  });
  if (!res.ok) {
    throw new Error(`Gmail watch failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function stopWatch(accessToken: string): Promise<void> {
  const res = await fetch(`${GMAIL_BASE}/stop`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Gmail stop-watch failed (${res.status}): ${await res.text()}`);
  }
}
