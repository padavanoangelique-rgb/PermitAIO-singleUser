import "server-only";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Gmail API ${path} failed (${res.status}): ${await res.text()}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
}

export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const data = await gmailFetch(accessToken, "/labels");
  return data.labels ?? [];
}

/** Returns the label's id, creating it (as a user label) if it doesn't exist yet. */
export async function ensureLabel(accessToken: string, name: string): Promise<string> {
  const labels = await listLabels(accessToken);
  const existing = labels.find((l) => l.name === name);
  if (existing) return existing.id;

  const created = await gmailFetch(accessToken, "/labels", {
    method: "POST",
    body: JSON.stringify({
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
  return created.id;
}

export async function addLabelToMessage(
  accessToken: string,
  messageId: string,
  labelId: string,
): Promise<void> {
  await gmailFetch(accessToken, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  internalDate: string;
}

/** Fetches just the headers/snippet needed to hand a message to the classifier — never the full body here. */
export async function getMessageSummary(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageSummary> {
  const data = await gmailFetch(
    accessToken,
    `/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
  );
  const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
  const from = headers.find((h) => h.name === "From")?.value ?? "";
  const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
  return {
    id: data.id,
    threadId: data.threadId,
    from,
    subject,
    snippet: data.snippet ?? "",
    internalDate: data.internalDate,
  };
}

/** First-run / fallback: most recent INBOX messages, newest first. */
export async function listRecentInboxMessageIds(
  accessToken: string,
  maxResults = 20,
): Promise<string[]> {
  const data = await gmailFetch(
    accessToken,
    `/messages?labelIds=INBOX&maxResults=${maxResults}`,
  );
  return (data.messages ?? []).map((m: { id: string }) => m.id);
}

export interface HistoryResult {
  newMessageIds: string[];
  latestHistoryId: string;
  /** True if Google could not satisfy startHistoryId (too old / expired) — caller should fall back to listRecentInboxMessageIds. */
  historyExpired: boolean;
}

/** Incremental sync: messages added to INBOX since startHistoryId. */
export async function listHistorySinceId(
  accessToken: string,
  startHistoryId: string,
): Promise<HistoryResult> {
  const messageIds = new Set<string>();
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;

  try {
    do {
      const params = new URLSearchParams({
        startHistoryId,
        historyTypes: "messageAdded",
        labelId: "INBOX",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await gmailFetch(accessToken, `/history?${params.toString()}`);
      for (const entry of data.history ?? []) {
        for (const added of entry.messagesAdded ?? []) {
          messageIds.add(added.message.id);
        }
      }
      if (data.historyId) latestHistoryId = data.historyId;
      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) {
      return { newMessageIds: [], latestHistoryId: startHistoryId, historyExpired: true };
    }
    throw err;
  }

  return { newMessageIds: Array.from(messageIds), latestHistoryId, historyExpired: false };
}
