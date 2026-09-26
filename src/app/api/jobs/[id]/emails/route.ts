import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JOB_MAIL_FROM_ADDRESS, escapeHtml, jobReplyAddress } from "@/lib/job-emails/config";
import { contractorAlias } from "@/lib/chat/contractor-alias";
import { emailSnippet } from "@/lib/job-emails/snippet";

export const runtime = "nodejs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_ATTACH_BYTES = 30 * 1024 * 1024;
const MAX_RECIPIENTS = 10;

type Table = { from: (name: string) => any };

function splitAddresses(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(",") : String(value ?? "");
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isEmail(value: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

/** Sends an email from a job (e.g. an engineering request). Replies come back through the Resend inbound webhook. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email sending is not configured (RESEND_API_KEY)." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Sign in to send email." }, { status: 401 });

  // RLS limits this to jobs in the signed-in user's organizations.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, org_id, job_number, client_name, address, city")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    to?: unknown;
    cc?: unknown;
    subject?: string;
    text?: string;
    fileIds?: string[];
    copyMe?: boolean;
  };

  const to = splitAddresses(body.to);
  const cc = splitAddresses(body.cc);
  const subjectRaw = String(body.subject ?? "").trim();
  const text = String(body.text ?? "").trim();
  if (to.length === 0) return NextResponse.json({ error: "Add at least one recipient." }, { status: 400 });
  if (to.length + cc.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `Up to ${MAX_RECIPIENTS} recipients per email.` }, { status: 400 });
  }
  const badAddress = [...to, ...cc].find((a) => !isEmail(a));
  if (badAddress) return NextResponse.json({ error: `"${badAddress}" is not a valid email address.` }, { status: 400 });
  if (!subjectRaw || subjectRaw.length > 200) {
    return NextResponse.json({ error: "Add a subject (200 characters max)." }, { status: 400 });
  }
  if (!text || text.length > 20000) {
    return NextResponse.json({ error: "Write a message (20,000 characters max)." }, { status: 400 });
  }
  const jobNumber = String(job.job_number ?? "");
  const subject = subjectRaw.includes(jobNumber) ? subjectRaw : `[Job ${jobNumber}] ${subjectRaw}`;

  const admin = createAdminClient();

  // Attachments come from this job's Documents (job_files) so nothing is uploaded twice.
  const attachments: { filename: string; content: string }[] = [];
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.slice(0, 20) : [];
  if (fileIds.length > 0) {
    const { data: files } = await supabase
      .from("job_files")
      .select("id, file_name, storage_path, size_bytes")
      .eq("job_id", job.id)
      .in("id", fileIds);
    let total = 0;
    for (const f of files ?? []) {
      total += f.size_bytes ?? 0;
      if (total > MAX_ATTACH_BYTES) {
        return NextResponse.json({ error: "Attachments are over 30 MB in total." }, { status: 400 });
      }
      const { data: blob, error: dlError } = await admin.storage.from("job-files").download(f.storage_path);
      if (dlError || !blob) {
        return NextResponse.json({ error: `Couldn't read "${f.file_name}" from storage.` }, { status: 500 });
      }
      attachments.push({
        filename: f.file_name,
        content: Buffer.from(await blob.arrayBuffer()).toString("base64"),
      });
    }
  }

  const { data: org } = await (admin as unknown as Table)
    .from("organizations")
    .select("name, slug")
    .eq("id", job.org_id)
    .maybeSingle();
  const orgName = String(org?.name ?? "").replace(/["<>]/g, "").trim();
  // Send as the contractor (guardian@permitaio.com) and ask for replies there: that address is a Google
  // alias on the agent inbox, so replies are filed on the job by the Gmail agent. Falls back to the
  // platform address + per-job reply address if the org has no slug.
  const senderAddress = org?.slug ? contractorAlias(String(org.slug)) : JOB_MAIL_FROM_ADDRESS;
  const from = `${orgName || "PermitAIO"} <${senderAddress}>`;
  const replyTo = org?.slug ? senderAddress : jobReplyAddress(job.id);

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">`,
    `<div>${escapeHtml(text).replace(/\n/g, "<br>")}</div>`,
    `<p style="margin-top:20px;font-size:12px;color:#666">Reply to this email to respond. Your reply and any attachments are filed on job ${escapeHtml(jobNumber)} in PermitAIO.</p>`,
    `</div>`,
  ].join("");

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      ...(cc.length ? { cc } : {}),
      ...(body.copyMe && user.email ? { bcc: [user.email] } : {}),
      reply_to: replyTo,
      subject,
      html,
      text,
      ...(attachments.length ? { attachments } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("job email send failed", res.status, detail);
    return NextResponse.json({ error: "The email service rejected this message.", detail: detail.slice(0, 300) }, { status: 502 });
  }
  const sent = (await res.json().catch(() => ({}))) as { id?: string };

  const names = attachments.map((a) => a.filename);
  const recipients = [...to, ...cc].join(", ");
  const { data: row, error: rowError } = await (admin as unknown as Table)
    .from("job_emails")
    .insert({
      org_id: job.org_id,
      job_id: job.id,
      direction: "outbound",
      from_addr: senderAddress,
      to_addrs: recipients,
      subject,
      summary: emailSnippet(text),
      attachment_names: names,
      provider_id: sent.id ?? null,
      sent_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (rowError) console.error("job_emails insert", rowError);

  await (admin as unknown as Table).from("job_activity").insert({
    org_id: job.org_id,
    job_id: job.id,
    user_id: user.id,
    activity_type: "system",
    message: `Email sent to ${recipients}: "${subject}"${names.length ? ` (${names.length} attachment${names.length === 1 ? "" : "s"})` : ""}.`,
  });

  return NextResponse.json({ ok: true, id: row?.id ?? null });
}
