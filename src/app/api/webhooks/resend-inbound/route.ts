import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobIdFromAddresses } from "@/lib/job-emails/config";
import { emailSnippet, htmlToText } from "@/lib/job-emails/snippet";
import { notify } from "@/lib/notifications/notify";

export const runtime = "nodejs";

const RESEND_API = "https://api.resend.com";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type Table = { from: (name: string) => any };

type ReceivedAttachment = {
  id?: string;
  filename?: string;
  content_type?: string;
  size?: number;
  download_url?: string;
};

/** Resend signs webhooks with Svix: HMAC-SHA256 over "<id>.<timestamp>.<body>" using the base64 secret. */
function verifySvix(raw: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
  const expectedBuf = Buffer.from(expected);
  return sigHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}

async function resendJson(path: string, apiKey: string): Promise<any | null> {
  try {
    const res = await fetch(`${RESEND_API}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return value ? [String(value)] : [];
}

/**
 * Inbound email: a reply to a message sent from a job (Reply-To j-<job id>@<reply domain>).
 * Files the reply on the job (summary only), saves its attachments to Documents, adds a job
 * note, and notifies whoever sent the original email.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret || !apiKey) {
    return NextResponse.json({ error: "Inbound email is not configured." }, { status: 503 });
  }
  const raw = await req.text();
  if (!verifySvix(raw, req.headers, secret)) {
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  let event: { type?: string; data?: Record<string, any> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data) {
    return NextResponse.json({ ok: true, ignored: "not an inbound email" });
  }
  const data = event.data;
  const emailId = String(data.email_id ?? data.id ?? "");
  if (!emailId) return NextResponse.json({ ok: true, ignored: "no email id" });

  const jobId = jobIdFromAddresses([...asList(data.to), ...asList(data.cc)]);
  if (!jobId) return NextResponse.json({ ok: true, ignored: "no job address" });

  const admin = createAdminClient();
  const db = admin as unknown as Table;

  const { data: job } = await db
    .from("jobs")
    .select("id, org_id, job_number, permit_tech")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ ok: true, ignored: "unknown job" });

  const { data: already } = await db
    .from("job_emails")
    .select("id")
    .eq("direction", "inbound")
    .eq("provider_id", emailId)
    .maybeSingle();
  if (already) return NextResponse.json({ ok: true, duplicate: true });

  // The webhook carries headers only; the body and attachment links come from the receiving API.
  const email = (await resendJson(`/emails/receiving/${emailId}`, apiKey)) ?? {};
  const from = String(email.from ?? data.from ?? "Unknown sender");
  const subject = String(email.subject ?? data.subject ?? "(no subject)");
  const bodyText = String(email.text ?? "") || htmlToText(String(email.html ?? ""));

  const listed = await resendJson(`/emails/receiving/${emailId}/attachments`, apiKey);
  const attachments: ReceivedAttachment[] = Array.isArray(listed?.data)
    ? listed.data
    : Array.isArray(email.attachments)
      ? email.attachments
      : Array.isArray(data.attachments)
        ? data.attachments
        : [];

  const saved: string[] = [];
  for (const att of attachments) {
    try {
      let url = att.download_url;
      if (!url && att.id) {
        const one = await resendJson(`/emails/receiving/${emailId}/attachments/${att.id}`, apiKey);
        url = one?.download_url;
      }
      if (!url) continue;
      const fileRes = await fetch(url);
      if (!fileRes.ok) continue;
      const buf = Buffer.from(await fileRes.arrayBuffer());
      if (buf.length > MAX_FILE_BYTES) continue;
      const fileName = att.filename || "attachment";
      const safeName = fileName.replace(/[^\w.\-]/g, "_");
      const path = `${job.id}/${Date.now()}-${safeName}`;
      const { error: upError } = await admin.storage
        .from("job-files")
        .upload(path, buf, { contentType: att.content_type || "application/octet-stream" });
      if (upError) continue;
      const { error: fileRowError } = await db.from("job_files").insert({
        org_id: job.org_id,
        job_id: job.id,
        file_name: fileName,
        storage_path: path,
        size_bytes: buf.length,
        uploaded_by: null,
        category: "supporting-doc",
      });
      if (fileRowError) {
        await admin.storage.from("job-files").remove([path]);
        continue;
      }
      saved.push(fileName);
    } catch (err) {
      console.error("inbound attachment", err);
    }
  }

  const { error: rowError } = await db.from("job_emails").insert({
    org_id: job.org_id,
    job_id: job.id,
    direction: "inbound",
    from_addr: from,
    to_addrs: asList(data.to).join(", "),
    subject,
    summary: emailSnippet(bodyText),
    attachment_names: saved,
    provider_id: emailId,
    message_id: String(data.message_id ?? email.message_id ?? "") || null,
  });
  if (rowError) {
    console.error("job_emails inbound insert", rowError);
    return NextResponse.json({ error: "Could not log the email." }, { status: 500 });
  }

  await db.from("job_activity").insert({
    org_id: job.org_id,
    job_id: job.id,
    user_id: null,
    activity_type: "system",
    message: `Email reply from ${from}: "${subject}"${saved.length ? ` — ${saved.length} attachment${saved.length === 1 ? "" : "s"} saved to Documents (${saved.join(", ")})` : ""}.`,
  });

  // Tell whoever sent the latest outbound email on this job (falls back to the permit tech).
  const { data: lastOut } = await db
    .from("job_emails")
    .select("sent_by")
    .eq("job_id", job.id)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await notify({
    orgId: job.org_id,
    jobId: job.id,
    permitTech: job.permit_tech ?? null,
    source: "email_agent",
    message: `Email reply on job ${job.job_number} from ${from}${saved.length ? ` (${saved.length} file${saved.length === 1 ? "" : "s"} saved)` : ""}.`,
    recipientUserId: lastOut?.sent_by ?? null,
  });

  return NextResponse.json({ ok: true, files: saved.length });
}
