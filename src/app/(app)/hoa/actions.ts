"use server";

import { adoptSpineHoa } from "@/lib/hoa/adopt";
import { requireActiveOrg } from "@/lib/data/orgs";
import { createClient } from "@/lib/supabase/server";

export async function addDirectoryHoaToTracker(spineId: string) {
  return adoptSpineHoa(spineId);
}

export async function saveHoaNotes(hoaId: string, notes: string) {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("hoas")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", hoaId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function saveHoaJobNotes(jobId: string, notes: string) {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("hoa_jobs")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function sendHoaApplication(args: { hoaJobId: string; documentId: string }) {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "Email is not configured yet." };

  const { data: job, error: jobErr } = await supabase
    .from("hoa_jobs")
    .select("id, job_number, job_name, address, notes, hoa_id")
    .eq("id", args.hoaJobId)
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  if (jobErr || !job) return { error: jobErr?.message ?? "Job not found." };
  if (!job.hoa_id) return { error: "This job is not linked to an HOA." };

  const { data: hoa, error: hoaErr } = await supabase
    .from("hoas")
    .select("id, name, email")
    .eq("id", job.hoa_id)
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  if (hoaErr || !hoa) return { error: hoaErr?.message ?? "HOA not found." };
  const to = (hoa.email ?? "").trim();
  if (!to.includes("@")) return { error: "This HOA has no email on file. Add one, then send." };

  const { data: doc, error: docErr } = await supabase
    .from("hoa_documents")
    .select("id, file_name, storage_path")
    .eq("id", args.documentId)
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  if (docErr || !doc) return { error: docErr?.message ?? "File not found." };

  const { data: file, error: fileErr } = await supabase.storage.from("hoa-documents").download(doc.storage_path);
  if (fileErr || !file) return { error: fileErr?.message ?? "Couldn't read that file." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const jobNumber = job.job_number || "HOA job";
  const subject = `[PermitAIO HOA] ${jobNumber} ${job.job_name || ""} — application`.replace(/\s+/g, " ").trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PermitAIO <notifications@permitaio.com>",
      to: [to],
      reply_to: "agent@permitaio.com",
      subject,
      html: `<p>Please find the HOA application for <strong>${escapeHtml(job.job_name || jobNumber)}</strong>.</p>
        <p>Job #: ${escapeHtml(jobNumber)}<br/>Address: ${escapeHtml(job.address || "")}<br/>Association: ${escapeHtml(hoa.name)}</p>
        <p>Reply to this email. Our agent will file what you send back on this job.</p>`,
      attachments: [{ filename: doc.file_name, content: bytes.toString("base64") }],
    }),
  });
  if (!res.ok) return { error: `Email did not send (${res.status}).` };

  const stamp = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
  const line = `Sent application (${doc.file_name}) to ${to} on ${stamp}.`;
  const notes = [job.notes?.trim(), line].filter(Boolean).join("\n");
  await supabase.from("hoa_jobs").update({ notes, updated_at: new Date().toISOString() }).eq("id", job.id).eq("org_id", activeOrg.id);
  return { ok: true as const, sentTo: to };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}
