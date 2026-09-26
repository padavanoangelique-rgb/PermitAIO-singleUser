"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { notify } from "@/lib/notifications/notify";
import { recordAssignedRole } from "@/lib/record-assigned-role";

function raw(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
}

/** Looks up a runner_members row's user_id/name so an assignment can
 * notify that specific person — returns null if the id is missing, or if
 * they haven't signed in yet (no user_id). */
async function runnerInfo(supabase: Awaited<ReturnType<typeof createClient>>, id: string | null) {
  if (!id) return null;
  const { data } = await raw(supabase).from("runner_members").select("user_id, display_name, email").eq("id", id).maybeSingle();
  return data as { user_id: string | null; display_name: string | null; email: string } | null;
}

/** The signed-in user's own runner_members row in this org, if any — this
 * is what gates whether they see the stripped-down runner view or the
 * send/manage view on /runner. */
export async function findMyRunner(orgId: string, userId: string, email: string) {
  const supabase = await createClient();
  const { data } = await raw(supabase)
    .from("runner_members")
    .select("id, user_id, email, display_name")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as { id: string; user_id: string | null; email: string; display_name: string | null };
  // Fall back to matching by email for someone added to the roster before
  // they ever signed in (mirrors install's addInstallMember pattern).
  const { data: byEmail } = await raw(supabase)
    .from("runner_members")
    .select("id, user_id, email, display_name")
    .eq("org_id", orgId)
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (byEmail as { id: string; user_id: string | null; email: string; display_name: string | null } | null) ?? null;
}

/** Any signed-in org member can hand the runner a job — this is
 * deliberately low-friction, same as any tech being able to pick up a job
 * on the Install board. */
export async function sendJobToRunner(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const place = String(formData.get("place") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const runnerId = String(formData.get("runnerId") ?? "") || null;
  if (!jobId || !jobNumber || !place) return;

  const supabase = await createClient();
  const db = raw(supabase);
  const { error } = await db.from("runner_jobs").insert({
    org_id: activeOrg.id,
    job_id: jobId,
    job_number: jobNumber,
    place,
    note,
    runner_id: runnerId,
    assigned_by_email: user.email ?? null,
  });
  if (error) {
    console.error("sendJobToRunner", error.message);
  } else if (runnerId) {
    const runner = await runnerInfo(supabase, runnerId);
    if (runner?.user_id) {
      await notify({
        orgId: activeOrg.id,
        jobId,
        permitTech: null,
        source: "runner_assign",
        message: `New run: ${jobNumber} — ${place}`,
        recipientUserId: runner.user_id,
      });
    }
  }
  revalidatePath("/runner");
}

/** Clocks the runner in at a place. Restricted to the run's own assigned
 * runner — this is her clocking herself in, not something a manager does
 * on her behalf. */
export async function checkInRun(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const runId = String(formData.get("runId") ?? "");
  if (!runId) return;

  const me = await findMyRunner(activeOrg.id, user.id, user.email ?? "");
  if (!me) return;

  const supabase = raw(await createClient());
  await supabase
    .from("runner_jobs")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", runId);
  revalidatePath("/runner");
}

/** Clocks the runner out at a place — same restriction as checkInRun. */
export async function checkOutRun(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const runId = String(formData.get("runId") ?? "");
  if (!runId) return;

  const me = await findMyRunner(activeOrg.id, user.id, user.email ?? "");
  if (!me) return;

  const supabase = raw(await createClient());
  await supabase
    .from("runner_jobs")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", runId);
  revalidatePath("/runner");
}

/** Adds someone straight to the runner roster — no email invite (that
 * pattern went to spam for the install module and was removed there for
 * the same reason). Points the admin at the self-serve join-code flow
 * instead. */
export async function addRunnerMember(formData: FormData) {
  const { activeOrg } = await requireActiveOrg();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const next = String(formData.get("next") ?? "/runner");
  const bounce = (msg: string) => {
    const path = next.startsWith("/") ? next : "/runner";
    const sep = path.includes("?") ? "&" : "?";
    redirect(`${path}${sep}mail=` + encodeURIComponent(msg));
  };
  if (!email || !email.includes("@")) {
    bounce("Enter a valid email.");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();

  const db = raw(supabase);
  const { error } = await db.from("runner_members").insert({
    org_id: activeOrg.id,
    email,
    display_name: displayName,
    user_id: profile?.id ?? null,
  });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    bounce(error.message);
  }
  await recordAssignedRole(activeOrg.id, email, "runner");

  revalidatePath("/runner");
  revalidatePath("/settings");
  const who = displayName || email;
  if (profile?.id) {
    bounce(`${who} is on the runner roster. They go to permitaio.com/join, enter the company code, and create a password.`);
  }
  bounce(`Added ${who}. They go to permitaio.com/join, enter your company code, and create their own password.`);
}
