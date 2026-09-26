"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { SITE_URL } from "@/lib/site-config";
import { ensureHomeownerLink } from "@/lib/sales/link";
import { contractorStampForOrg } from "@/lib/sales/brand";

function salesPath(jobNumber: string, mail: string) {
  const q = new URLSearchParams();
  if (jobNumber) q.set("job", jobNumber);
  if (mail) q.set("mail", mail);
  const s = q.toString();
  return s ? `/sales?${s}` : "/sales";
}

function afterPath(formData: FormData, jobNumber: string, mail: string) {
  const returnTo = String(formData.get("returnTo") ?? "");
  if (returnTo.startsWith("/jobs/")) {
    const q = mail ? `?mail=${encodeURIComponent(mail)}` : "";
    return `${returnTo}${q}`;
  }
  return salesPath(jobNumber, mail);
}

export async function addSalesNote(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const message = String(formData.get("note") ?? "").trim();
  if (!jobId || !message) redirect(salesPath(jobNumber, "Write a note first."));
  const supabase = await createClient();
  const author =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    user.email?.split("@")[0] ||
    user.email ||
    "Sales";
  const { error } = await supabase.from("job_activity").insert({
    org_id: activeOrg.id,
    job_id: jobId,
    user_id: user.id,
    activity_type: "note",
    message: `${author}: ${message}`,
  });
  if (error) redirect(salesPath(jobNumber, error.message));
  revalidatePath("/sales");
  redirect(salesPath(jobNumber, "Note saved on the job."));
}

export async function emailHomeownerLink(formData: FormData) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const clientName = String(formData.get("clientName") ?? "");
  const address = String(formData.get("address") ?? "");
  const to = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!to.includes("@")) redirect(afterPath(formData, jobNumber, "Enter the homeowner email."));
  const token = await ensureHomeownerLink(activeOrg.id, jobId);
  const url = `${SITE_URL}/track/${token}`;
  const supabase = await createClient();
  const stamp = await contractorStampForOrg(supabase, activeOrg.id);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) redirect(afterPath(formData, jobNumber, "Email is not configured."));
  const brand = escapeHtml(stamp.name);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PermitAIO <notifications@permitaio.com>",
      to: [to],
      reply_to: stamp.email || "hello@permitaio.com",
      subject: `${stamp.name} — your permit status${address ? ` — ${address}` : ""}`,
      html: `<p>Hi${clientName ? ` ${escapeHtml(clientName.split(" ")[0])}` : ""},</p>
        <p>${brand} set up this private page so you can check the status of your permit anytime. No login needed.</p>
        <p><a href="${url}">${url}</a></p>
        <p>The page shows permit and HOA status, plus typical timing (about 3 weeks for the city, about 4 weeks for the HOA after we file).</p>`,
    }),
  });
  if (!res.ok) redirect(afterPath(formData, jobNumber, `Email did not send (${res.status}).`));
  revalidatePath("/sales");
  revalidatePath("/jobs");
  redirect(afterPath(formData, jobNumber, `Status link emailed to ${to}.`));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}
