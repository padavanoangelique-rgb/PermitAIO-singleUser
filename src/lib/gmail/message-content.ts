import "server-only";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

interface GmailFullMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailPart;
}

export interface GmailMessageContent {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  internalDate?: string;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function collectText(part: GmailPart | undefined, mimeType: string, output: string[]) {
  if (!part) return;
  if (part.mimeType === mimeType && part.body?.data && !part.filename) {
    output.push(decodeBase64Url(part.body.data));
  }
  for (const child of part.parts ?? []) collectText(child, mimeType, output);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

function header(part: GmailPart | undefined, name: string): string {
  return part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function getFullMessageContent(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageContent> {
  const res = await fetch(`${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail full-message read failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as GmailFullMessage;
  const plain: string[] = [];
  const html: string[] = [];
  collectText(data.payload, "text/plain", plain);
  collectText(data.payload, "text/html", html);

  let body = plain.join("\n\n").trim();
  if (!body && html.length) body = stripHtml(html.join("\n\n"));

  // The agent never needs an unlimited raw email body. Bound memory and
  // processing while retaining far more text than a normal permit notice uses.
  if (body.length > 100_000) body = body.slice(0, 100_000);

  return {
    id: data.id,
    threadId: data.threadId,
    from: header(data.payload, "From"),
    to: header(data.payload, "To"),
    subject: header(data.payload, "Subject"),
    body,
    internalDate: data.internalDate,
  };
}
