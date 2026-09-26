"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { notify } from "@/lib/notifications/notify";

function afterPath(formData: FormData, jobNumber: string, mail: string) {
  const returnTo = String(formData.get("returnTo") ?? "");
  const q = new URLSearchParams();
  if (jobNumber) q.set("job", jobNumber);
  if (mail) q.set("mail", mail);
  const s = q.toString();
  const base = returnTo.startsWith("/") ? returnTo : "/sales";
  return s ? `${base}${base.includes("?") ? "&" : "?"}${s}` : base;
}

/**
 * "Request update" button on the shared permit/HOA status page (Sales and
 * Install both use it). Sales picks which tech to ask — permit or HOA.
 * Writes the same job_activity note Sales notes already use, then fans it
 * into the notifications pipeline (notify.ts) so it lands in that tech's
 * bell and the "Needs attention" card the same way an agent-flagged job
 * does. Records the requester so the tech can reply straight back.
 */
export async function requestStatusUpdate(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const requesterRole = String(formData.get("requesterRole") ?? "Team");
  const target = String(formData.get("target") ?? "permit") === "hoa" ? "hoa" : "permit";
  if (!jobId) redirect(afterPath(formData, jobNumber, "Missing job."));

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("permit_tech, hoa_tech")
    .eq("org_id", activeOrg.id)
    .eq("id", jobId)
    .maybeSingle();

  let tech = target === "hoa" ? job?.hoa_tech ?? null : job?.permit_tech ?? null;
  if (target === "hoa" && !tech) {
    const { data: hoaJob } = await supabase
      .from("hoa_jobs")
      .select("assigned_to")
      .eq("org_id", activeOrg.id)
      .eq("job_id", jobId)
      .maybeSingle();
    tech = hoaJob?.assigned_to ?? null;
  }

  const author =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    user.email?.split("@")[0] ||
    user.email ||
    requesterRole;

  const targetLabel = target === "hoa" ? "HOA" : "permit";
  const message = `${author} (${requesterRole}) requested a ${targetLabel} status update on ${jobNumber || "this job"}.`;

  await supabase.from("job_activity").insert({
    org_id: activeOrg.id,
    job_id: jobId,
    user_id: user.id,
    activity_type: "note",
    message,
  });

  await notify({
    orgId: activeOrg.id,
    jobId,
    permitTech: tech,
    source: "team_request",
    message,
    requestedBy: user.id,
  });

  revalidatePath("/sales");
  revalidatePath("/install/status");
  redirect(afterPath(formData, jobNumber, `Update requested — the ${targetLabel} tech has been notified.`));
}
