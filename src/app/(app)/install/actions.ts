"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg, canManageOrg } from "@/lib/data/orgs";
import { notify } from "@/lib/notifications/notify";
import { recordAssignedRole } from "@/lib/record-assigned-role";

type InstallRole = "install_manager" | "account_manager" | "project_manager" | "installer";

function raw(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> & {
          ilike: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: { id?: string } | null; error: { message: string } | null }>;
          };
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      delete: () => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  };
}

/** Looks up an install_members row's user_id/name so an assign/schedule
 * action can notify that specific person — returns null if no one is
 * assigned in that slot, or they haven't signed in yet (no user_id). */
async function memberInfo(supabase: Awaited<ReturnType<typeof createClient>>, id: string | null) {
  if (!id) return null;
  const { data } = await raw(supabase)
    .from("install_members")
    .select("user_id, display_name, email")
    .eq("id", id)
    .maybeSingle();
  return data as { user_id: string | null; display_name: string | null; email: string } | null;
}

export async function addJobToInstallBoard(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) {
    redirect("/install?mail=" + encodeURIComponent("Pick a job number."));
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number")
    .eq("org_id", activeOrg.id)
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    redirect("/install?mail=" + encodeURIComponent("That job number is not in PermitAIO."));
  }

  const db = raw(supabase);
  const { error } = await db.from("install_job_assignments").upsert(
    {
      org_id: activeOrg.id,
      job_id: job.id,
      job_number: job.job_number,
      assigned_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,job_id" },
  );
  if (error) {
    redirect("/install?mail=" + encodeURIComponent(error.message));
  }
  revalidatePath("/install");
  redirect("/install?mail=" + encodeURIComponent(`Added ${job.job_number} to the install board.`));
}

/** Adds someone to the install roster. This used to also fire a Supabase
 * email invite for brand-new people — that email routinely landed in spam
 * with no fallback, so the new person had an account they could never get
 * into. The self-serve join-code flow (permitaio.com/join/install, QR code
 * in Settings) already covers first-time sign-up without an email round
 * trip, so this just points the admin at that instead. */
export async function addInstallMember(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as InstallRole;
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const companyName = String(formData.get("companyName") ?? "").trim() || null;
  const next = String(formData.get("next") ?? "/install");
  const bounce = (msg: string) => {
    const path = next.startsWith("/") ? next : "/install";
    const sep = path.includes("?") ? "&" : "?";
    redirect(`${path}${sep}mail=` + encodeURIComponent(msg));
  };
  if (!email || !email.includes("@") || !role) {
    bounce("Enter a valid email.");
  }

  const supabase = await createClient();
  const db = raw(supabase);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  const { error: rosterError } = await db.from("install_members").insert({
    org_id: activeOrg.id,
    email,
    role,
    display_name: displayName,
    company_name: companyName,
    user_id: profile?.id ?? null,
    invited_by: user.id,
  });
  if (rosterError && !rosterError.message.toLowerCase().includes("duplicate")) {
    bounce(rosterError.message);
  }

  await recordAssignedRole(activeOrg.id, email, role);

  revalidatePath("/install");
  revalidatePath("/settings");

  const who = displayName || email;
  if (profile?.id) {
    bounce(`${who} is on the install roster. They go to permitaio.com/join, enter the company code, and create a password.`);
  }
  bounce(
    `Added ${who}. They go to permitaio.com/join, enter your company code, and create their own password. No email invite.`,
  );
}

/** Revokes one install role — deletes the install_members roster row. The
 * person keeps their base org membership; only that specific install role
 * (account manager, project manager, installer, or install manager) goes
 * away, so they stop seeing the boards/dashboards gated on it. */
export async function removeInstallMember(formData: FormData) {
  const { activeOrg, role } = await requireActiveOrg();
  if (!canManageOrg(role)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = raw(await createClient());
  await supabase.from("install_members").delete().eq("id", id).eq("org_id", activeOrg.id);

  revalidatePath("/settings");
  revalidatePath("/install");
}

export async function assignAccountManager(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const accountManagerId = String(formData.get("accountManagerId") ?? "") || null;
  if (!jobId || !jobNumber) return;

  const supabase = await createClient();
  const db = raw(supabase);
  const { error } = await db.from("install_job_assignments").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      job_number: jobNumber,
      account_manager_id: accountManagerId,
      assigned_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,job_id" },
  );
  if (error) {
    console.error("assignAccountManager", error.message);
  } else if (accountManagerId) {
    const am = await memberInfo(supabase, accountManagerId);
    if (am?.user_id) {
      await notify({
        orgId: activeOrg.id,
        jobId,
        permitTech: null,
        source: "install_assign",
        message: `You were assigned as account manager on ${jobNumber}.`,
        recipientUserId: am.user_id,
      });
    }
  }
  revalidatePath("/install");
}

export async function assignInstallJob(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const installerId = String(formData.get("installerId") ?? "") || null;
  const pmId = String(formData.get("pmId") ?? "") || null;
  const inspectionDate = String(formData.get("inspectionDate") ?? "") || null;
  const inspectionResult = String(formData.get("inspectionResult") ?? "") || null;
  if (!jobId || !jobNumber) return;

  let inspectionStatus: string | null = null;
  if (inspectionResult === "passed" || inspectionResult === "failed") inspectionStatus = inspectionResult;
  else if (inspectionDate) inspectionStatus = "scheduled";

  const supabase = await createClient();
  const db = raw(supabase);
  const { error } = await db.from("install_job_assignments").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      job_number: jobNumber,
      installer_id: installerId,
      pm_id: pmId,
      inspection_date: inspectionDate,
      inspection_result: inspectionResult,
      inspection_status: inspectionStatus,
      assigned_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,job_id" },
  );
  if (error) {
    console.error("assignInstallJob", error.message);
  } else {
    const { data: job } = await supabase.from("jobs").select("client_name").eq("id", jobId).maybeSingle();
    const client = job?.client_name ?? "";
    for (const id of [installerId, pmId]) {
      const member = await memberInfo(supabase, id);
      if (member?.user_id) {
        await notify({
          orgId: activeOrg.id,
          jobId,
          permitTech: null,
          source: "install_assign",
          message: `You were assigned to ${jobNumber}${client ? ` (${client})` : ""}.`,
          recipientUserId: member.user_id,
        });
      }
    }
  }
  revalidatePath("/install");
  revalidatePath("/install/schedule");
  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/")) {
    const notice = String(formData.get("notice") ?? `Assigned ${jobNumber}.`);
    redirect(next + (next.includes("?") ? "&" : "?") + "mail=" + encodeURIComponent(notice));
  }
}

export async function checkInstallJob(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  if (!jobId || !jobNumber) {
    redirect("/install?mail=" + encodeURIComponent("Missing job number."));
  }

  const supabase = raw(await createClient());
  const now = new Date().toISOString();
  const { error } = await supabase.from("install_job_assignments").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      job_number: jobNumber,
      pm_checked_at: now,
      pm_checked_by: user.email ?? user.id,
      updated_at: now,
    },
    { onConflict: "org_id,job_id" },
  );
  const next = String(formData.get("next") ?? "/install");
  const dest = next.startsWith("/") ? next : "/install";
  const sep = dest.includes("?") ? "&" : "?";
  if (error) {
    redirect(`${dest}${sep}mail=` + encodeURIComponent(error.message));
  }
  revalidatePath("/install");
  redirect(`${dest}${sep}mail=` + encodeURIComponent(`Checked in ${jobNumber}.`));
}

export async function checkoutInstallPermit(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  if (!jobId || !jobNumber) {
    redirect("/install?mail=" + encodeURIComponent("Missing job number."));
  }

  const supabase = raw(await createClient());
  const now = new Date().toISOString();
  const { error } = await supabase.from("install_job_assignments").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      job_number: jobNumber,
      permit_checked_out_at: now,
      permit_checked_out_by: user.email ?? user.id,
      updated_at: now,
    },
    { onConflict: "org_id,job_id" },
  );
  if (error) {
    redirect("/install?mail=" + encodeURIComponent(error.message));
  }
  revalidatePath("/install");
  redirect("/install?mail=" + encodeURIComponent(`Permit checked out for ${jobNumber}.`));
}

export async function scheduleInstallJob(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const scheduledDate = String(formData.get("scheduledDate") ?? "") || null;
  const next = String(formData.get("next") ?? "");
  if (!jobId || !jobNumber) return;

  const supabase = await createClient();
  const db = raw(supabase);
  const { error } = await db.from("install_job_assignments").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      job_number: jobNumber,
      scheduled_date: scheduledDate,
      assigned_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,job_id" },
  );
  if (error) {
    console.error("scheduleInstallJob", error.message);
  } else if (scheduledDate) {
    const { data: assignment } = await db
      .from("install_job_assignments")
      .select("installer_id, pm_id")
      .eq("job_id", jobId)
      .maybeSingle();
    const row = assignment as { installer_id: string | null; pm_id: string | null } | null;
    for (const id of [row?.installer_id ?? null, row?.pm_id ?? null]) {
      const member = await memberInfo(supabase, id);
      if (member?.user_id) {
        await notify({
          orgId: activeOrg.id,
          jobId,
          permitTech: null,
          source: "install_assign",
          message: `${jobNumber} was scheduled for ${scheduledDate}.`,
          recipientUserId: member.user_id,
        });
      }
    }
  }
  revalidatePath("/install");
  revalidatePath("/install/calendar");
  revalidatePath("/install/schedule");
  if (next.startsWith("/")) {
    redirect(next + (next.includes("?") ? "&" : "?") + "mail=" + encodeURIComponent(`Scheduled ${jobNumber}.`));
  }
}

/** Deposit / change order / signed / final payment — the Install Manager's
 * money checklist for a job, stored as flat columns on the same
 * install_job_assignments row as inspection/check-in state. */
function numberOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function updateInstallPayment(formData: FormData) {
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  if (!jobId || !jobNumber) return;

  const db = raw(await createClient());
  const { error } = await db.from("install_job_assignments").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      job_number: jobNumber,
      deposit_collected: formData.get("depositCollected") === "on",
      deposit_amount: numberOrNull(formData.get("depositAmount")),
      deposit_date: String(formData.get("depositDate") ?? "") || null,
      change_order: formData.get("changeOrder") === "on",
      contract_signed: formData.get("contractSigned") === "on",
      final_payment_collected: formData.get("finalPaymentCollected") === "on",
      final_payment_amount: numberOrNull(formData.get("finalPaymentAmount")),
      final_payment_date: String(formData.get("finalPaymentDate") ?? "") || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,job_id" },
  );
  if (error) console.error("updateInstallPayment", error.message);
  revalidatePath("/install");
  revalidatePath(`/jobs/${jobId}`);
}
