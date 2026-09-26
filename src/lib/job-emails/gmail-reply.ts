import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/notify";
import { emailSnippet } from "./snippet";

// Replies to an email sent from a job arrive in the agent inbox (Reply-To is the contractor's
// alias). This files such a reply on its job: a short summary row, the attachments in Documents,
// a job note, and a notification to whoever sent the original.

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type Table = { from: (name: string) => any };

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}

export type InboundAttachment = { filename: string; contentType: string; data: Buffer };

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

/** "Re: [Job 1] x" and "[Job 1] x" compare equal. */
export function normalizeSubject(subject: string): string {
  return String(subject || "")
    .toLowerCase()
    .replace(/^\s*((re|fwd?)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectAttachmentParts(part: GmailPart | undefined, out: GmailPart[]) {
  if (!part) return;
  if (part.filename && (part.body?.attachmentId || part.body?.data)) out.push(part);
  for (const child of part.parts ?? []) collectAttachmentParts(child, out);
}

export async function fetchGmailAttachments(accessToken: string, messageId: string): Promise<InboundAttachment[]> {
  const res = await fetch(`${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail message read failed (${res.status})`);
  const data = (await res.json()) as { payload?: GmailPart };
  const parts: GmailPart[] = [];
  collectAttachmentParts(data.payload, parts);

  const out: InboundAttachment[] = [];
  for (const part of parts) {
    if ((part.body?.size ?? 0) > MAX_FILE_BYTES) continue;
    let buf: Buffer | null = null;
    if (part.body?.data) {
      buf = fromBase64Url(part.body.data);
    } else if (part.body?.attachmentId) {
      const attRes = await fetch(
        `${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!attRes.ok) continue;
      const att = (await attRes.json()) as { data?: string };
      if (att.data) buf = fromBase64Url(att.data);
    }
    if (!buf || buf.length === 0 || buf.length > MAX_FILE_BYTES) continue;
    out.push({ filename: part.filename || "attachment", contentType: part.mimeType || "application/octet-stream", data: buf });
  }
  return out;
}

/** Which job an incoming subject belongs to: a job email this shop sent with the same subject. */
export async function findOutboundThread(
  orgId: string,
  subject: string,
): Promise<{ jobId: string; sentBy: string | null } | null> {
  const key = normalizeSubject(subject);
  if (!key) return null;
  const db = createAdminClient() as unknown as Table;
  const { data } = await db
    .from("job_emails")
    .select("job_id, subject, sent_by")
    .eq("org_id", orgId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(300);
  const hit = ((data ?? []) as { job_id: string; subject: string; sent_by: string | null }[]).find(
    (row) => normalizeSubject(row.subject) === key,
  );
  return hit ? { jobId: hit.job_id, sentBy: hit.sent_by } : null;
}

export async function fileGmailReply(input: {
  orgId: string;
  jobId: string;
  sentBy: string | null;
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  gmailMessageId: string;
  attachments: InboundAttachment[];
}): Promise<{ filed: boolean; files: number }> {
  const admin = createAdminClient();
  const db = admin as unknown as Table;
  const providerId = `gmail:${input.gmailMessageId}`;

  const { data: already } = await db
    .from("job_emails")
    .select("id")
    .eq("direction", "inbound")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (already) return { filed: false, files: 0 };

  const { data: job } = await db
    .from("jobs")
    .select("id, org_id, job_number, permit_tech")
    .eq("id", input.jobId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (!job) return { filed: false, files: 0 };

  const saved: string[] = [];
  for (const att of input.attachments) {
    try {
      const safeName = att.filename.replace(/[^\w.\-]/g, "_");
      const path = `${job.id}/${Date.now()}-${safeName}`;
      const { error: upError } = await admin.storage
        .from("job-files")
        .upload(path, att.data, { contentType: att.contentType });
      if (upError) continue;
      const { error: fileRowError } = await db.from("job_files").insert({
        org_id: job.org_id,
        job_id: job.id,
        file_name: att.filename,
        storage_path: path,
        size_bytes: att.data.length,
        uploaded_by: null,
        category: "supporting-doc",
      });
      if (fileRowError) {
        await admin.storage.from("job-files").remove([path]);
        continue;
      }
      saved.push(att.filename);
    } catch (err) {
      console.error("gmail reply attachment", err);
    }
  }

  const { error: rowError } = await db.from("job_emails").insert({
    org_id: job.org_id,
    job_id: job.id,
    direction: "inbound",
    from_addr: input.from || "Unknown sender",
    to_addrs: input.to || "",
    subject: input.subject || "(no subject)",
    summary: emailSnippet(input.bodyText),
    attachment_names: saved,
    provider_id: providerId,
  });
  if (rowError) throw rowError;

  await db.from("job_activity").insert({
    org_id: job.org_id,
    job_id: job.id,
    user_id: null,
    activity_type: "system",
    message: `Email reply from ${input.from}: "${input.subject}"${
      saved.length ? ` — ${saved.length} attachment${saved.length === 1 ? "" : "s"} saved to Documents (${saved.join(", ")})` : ""
    }.`,
  });

  await notify({
    orgId: job.org_id,
    jobId: job.id,
    permitTech: job.permit_tech ?? null,
    source: "email_agent",
    message: `Email reply on job ${job.job_number} from ${input.from}${saved.length ? ` (${saved.length} file${saved.length === 1 ? "" : "s"} saved)` : ""}.`,
    recipientUserId: input.sentBy,
  });

  return { filed: true, files: saved.length };
}
