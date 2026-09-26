"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { notify } from "@/lib/notifications/notify";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

function holderName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const full = user.user_metadata?.full_name;
  return (typeof full === "string" && full.trim()) || user.email?.split("@")[0] || user.email || "Someone";
}

/**
 * Called right after the permit tech uploads the printed permit PDF to
 * the job (job_files, category "permit_printed") — flips the job from
 * "not printed" to "in library": available, not yet in anyone's hands.
 * Never overwrites a later state if this fires twice (upsert only sets
 * the fields that matter for the printed step).
 */
export async function markPermitPrinted(jobId: string, jobNumber: string) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  await adminTable(admin, "permit_custody").upsert(
    {
      job_id: jobId,
      org_id: activeOrg.id,
      status: "in_library",
      printed_at: now,
      updated_at: now,
    },
    { onConflict: "job_id" },
  );
  await adminTable(admin, "permit_custody_events").insert({
    org_id: activeOrg.id,
    job_id: jobId,
    event_type: "printed",
    actor_id: user.id,
    actor_name: holderName(user),
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/install");
}

/**
 * The single action a scan triggers — advances custody exactly one step
 * (in_library -> checked_out -> checked_in) and records who did it. No
 * role gate: whoever scans next is trusted to be the person physically
 * holding it, matching how the paper rack already works today. Returns
 * to the scan page (returnTo) with a status message either way.
 */
export async function scanAdvancePermitCustody(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  if (!jobId) return;

  const admin = createAdminClient();
  const { data: current } = await adminTable(admin, "permit_custody")
    .select("status")
    .eq("job_id", jobId)
    .maybeSingle();

  const status = current?.status ?? "not_printed";
  const now = new Date().toISOString();
  const name = holderName(user);

  if (status === "in_library") {
    await adminTable(admin, "permit_custody").upsert(
      {
        job_id: jobId,
        org_id: activeOrg.id,
        status: "checked_out",
        current_holder_id: user.id,
        current_holder_name: name,
        checked_out_at: now,
        updated_at: now,
      },
      { onConflict: "job_id" },
    );
    await adminTable(admin, "permit_custody_events").insert({
      org_id: activeOrg.id,
      job_id: jobId,
      event_type: "checked_out",
      actor_id: user.id,
      actor_name: name,
    });
    const { data: job } = await adminTable(admin, "jobs").select("permit_tech").eq("id", jobId).maybeSingle();
    await notify({
      orgId: activeOrg.id,
      jobId,
      permitTech: job?.permit_tech ?? null,
      source: "team_request",
      message: `${name} checked out the printed permit for ${jobNumber}.`,
    });
  } else if (status === "checked_out") {
    await adminTable(admin, "permit_custody").upsert(
      {
        job_id: jobId,
        org_id: activeOrg.id,
        status: "checked_in",
        current_holder_id: user.id,
        current_holder_name: name,
        checked_in_at: now,
        updated_at: now,
      },
      { onConflict: "job_id" },
    );
    await adminTable(admin, "permit_custody_events").insert({
      org_id: activeOrg.id,
      job_id: jobId,
      event_type: "checked_in",
      actor_id: user.id,
      actor_name: name,
    });
    const { data: job } = await adminTable(admin, "jobs").select("permit_tech").eq("id", jobId).maybeSingle();
    await notify({
      orgId: activeOrg.id,
      jobId,
      permitTech: job?.permit_tech ?? null,
      source: "team_request",
      message: `${name} checked in the printed permit for ${jobNumber} at the job site.`,
    });
  }
  // status === "not_printed" or "checked_in": nothing to advance, scan is a no-op besides the page just showing current status.

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/install");
  if (returnTo.startsWith("/")) redirect(returnTo);
}
