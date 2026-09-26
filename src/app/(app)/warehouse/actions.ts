"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { openingsForJob } from "@/lib/warehouse/openings";
import { permitIsApproved } from "@/lib/warehouse/permit";
import { notifyWarehouseReady, parseNotifyEmails } from "@/lib/warehouse/notify";
import { canManageOrg } from "@/lib/data/orgs";
import { notify } from "@/lib/notifications/notify";

function raw(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> & {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
        };
      };
      upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } };
      };
    };
  };
}

function warehousePath(jobNumber: string, mail: string) {
  const q = new URLSearchParams();
  if (jobNumber) q.set("job", jobNumber);
  if (mail) q.set("mail", mail);
  const s = q.toString();
  return s ? `/warehouse?${s}` : "/warehouse";
}

async function maybeCompleteJob(opts: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  jobId: string;
  jobNumber: string;
  clientName: string;
  address: string;
  userId: string;
  userEmail: string;
}) {
  const db = raw(opts.supabase);
  const planRes = await opts.supabase
    .from("floor_plans")
    .select("plan_data")
    .eq("org_id", opts.orgId)
    .eq("job_id", opts.jobId)
    .maybeSingle();
  const wj = (await opts.supabase
    .from("warehouse_jobs" as never)
    .select("manual_windows, manual_doors")
    .eq("org_id", opts.orgId)
    .eq("job_id", opts.jobId)
    .maybeSingle()) as {
    data: { manual_windows?: number | null; manual_doors?: number | null } | null;
  };
  const openings = openingsForJob(
    planRes.data?.plan_data,
    wj.data?.manual_windows ?? 0,
    wj.data?.manual_doors ?? 0,
  );
  if (openings.length === 0) return;

  const { data: jobLines } = (await opts.supabase
    .from("warehouse_checkins" as never)
    .select("opening_key, received_at, broken, note")
    .eq("org_id", opts.orgId)
    .eq("job_id", opts.jobId)) as {
    data: { opening_key: string; received_at: string | null; broken: boolean; note: string | null }[] | null;
  };

  const received = new Set((jobLines ?? []).filter((r) => r.received_at).map((r) => r.opening_key));
  if (!openings.every((o) => received.has(o.key))) return;

  const now = new Date().toISOString();
  await db.from("warehouse_jobs").upsert(
    {
      org_id: opts.orgId,
      job_id: opts.jobId,
      job_number: opts.jobNumber,
      ready_for_schedule_at: now,
      manual_windows: wj.data?.manual_windows ?? null,
      manual_doors: wj.data?.manual_doors ?? null,
      updated_at: now,
    },
    { onConflict: "org_id,job_id" },
  );

  await db.from("install_job_assignments").upsert(
    {
      org_id: opts.orgId,
      job_id: opts.jobId,
      job_number: opts.jobNumber,
      assigned_by: opts.userId,
      updated_at: now,
    },
    { onConflict: "org_id,job_id" },
  );

  const settings = await db.from("warehouse_settings").select("notify_email").eq("org_id", opts.orgId);
  const notifyEmail = parseNotifyEmails(((settings.data ?? [])[0] as { notify_email?: string } | undefined)?.notify_email);
  const broken = (jobLines ?? []).filter((r) => r.broken);
  const err = await notifyWarehouseReady({
    to: notifyEmail,
    jobNumber: opts.jobNumber,
    clientName: opts.clientName,
    address: opts.address,
    openingCount: openings.length,
    brokenCount: broken.length,
    brokenNotes: broken.map((b) => b.note || b.opening_key),
  });

  await db.from("warehouse_jobs").upsert(
    {
      org_id: opts.orgId,
      job_id: opts.jobId,
      job_number: opts.jobNumber,
      ready_for_schedule_at: now,
      notified_at: err ? null : now,
      manual_windows: wj.data?.manual_windows ?? null,
      manual_doors: wj.data?.manual_doors ?? null,
      updated_at: now,
    },
    { onConflict: "org_id,job_id" },
  );

  return err;
}

export async function saveWarehouseRecipient(formData: FormData) {
  await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  if (!canManageOrg(role)) {
    redirect("/settings?mail=" + encodeURIComponent("Only an owner or admin can set warehouse emails."));
  }
  const emails = parseNotifyEmails(String(formData.get("notifyEmail") ?? ""));
  const stored = emails.join(", ");
  const db = raw(await createClient());
  const { error } = await db.from("warehouse_settings").upsert(
    { org_id: activeOrg.id, notify_email: stored || null, updated_at: new Date().toISOString() },
    { onConflict: "org_id" },
  );
  if (error) redirect("/settings?mail=" + encodeURIComponent(error.message));
  revalidatePath("/settings");
  revalidatePath("/warehouse");
  redirect(
    "/settings?mail=" +
      encodeURIComponent(emails.length ? `Warehouse check-in emails: ${stored}.` : "Warehouse check-in emails cleared."),
  );
}

export async function setManualWarehouseCounts(formData: FormData) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const windows = Math.max(0, Number(formData.get("windows") ?? 0) || 0);
  const doors = Math.max(0, Number(formData.get("doors") ?? 0) || 0);
  if (!jobId || !jobNumber) {
    redirect(warehousePath(jobNumber, "Missing job number."));
  }
  if (windows + doors === 0) {
    redirect(warehousePath(jobNumber, "Enter how many windows and doors were received."));
  }
  const db = raw(await createClient());
  const { error } = await db.from("warehouse_jobs").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      job_number: jobNumber,
      manual_windows: windows,
      manual_doors: doors,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,job_id" },
  );
  if (error) redirect(warehousePath(jobNumber, error.message));
  revalidatePath("/warehouse");
  redirect(warehousePath(jobNumber, `Checklist built: ${windows} window${windows === 1 ? "" : "s"}, ${doors} door${doors === 1 ? "" : "s"}.`));
}

// Toggling one opening's checkbox happens a lot in a row (a whole checklist,
// one click per line) — redirecting after every single click reset scroll
// position and flashed a banner each time, which read as the page glitching.
// Only redirect for the rare, meaningful outcomes (a write error, the tech
// getting notified, or the whole checklist completing); an ordinary toggle
// just revalidates the data in place.
export async function toggleWarehouseOpening(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const clientName = String(formData.get("clientName") ?? "");
  const address = String(formData.get("address") ?? "");
  const openingKey = String(formData.get("openingKey") ?? "");
  const next = String(formData.get("next") ?? "") === "1";
  if (!jobId || !openingKey) return;

  const supabase = await createClient();
  const db = raw(supabase);
  const now = new Date().toISOString();
  const { error } = await db.from("warehouse_checkins").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      opening_key: openingKey,
      received_at: next ? now : null,
      received_by: next ? (user.email ?? user.id) : null,
      updated_at: now,
    },
    { onConflict: "org_id,job_id,opening_key" },
  );
  if (error) {
    redirect(warehousePath(jobNumber, error.message));
  }

  let mail: string | null = null;

  if (next) {
    const jobRow = await supabase
      .from("jobs")
      .select("sub_status, permit_tech")
      .eq("id", jobId)
      .eq("org_id", activeOrg.id)
      .maybeSingle();
    if (!permitIsApproved(jobRow.data?.sub_status)) {
      const { data: received } = (await supabase
        .from("warehouse_checkins" as never)
        .select("id")
        .eq("org_id", activeOrg.id)
        .eq("job_id", jobId)
        .not("received_at", "is", null)) as { data: { id: string }[] | null };
      if ((received ?? []).length === 1 && jobRow.data?.permit_tech) {
        await notify({
          orgId: activeOrg.id,
          jobId,
          permitTech: jobRow.data.permit_tech,
          source: "permits_agent",
          message: `Product arrived at warehouse for ${jobNumber}${clientName ? ` · ${clientName}` : ""}. Permit is not approved.`,
        });
        mail = `Checked in. ${jobRow.data.permit_tech} notified — product arrived, permit not approved.`;
      }
    }

    const complete = await maybeCompleteJob({
      supabase,
      orgId: activeOrg.id,
      jobId,
      jobNumber,
      clientName,
      address,
      userId: user.id,
      userEmail: user.email ?? "",
    });
    if (complete === null) mail = `${jobNumber} is checked in. Managers see it on Need to be scheduled. Email sent.`;
    else if (complete) mail = `${jobNumber} is checked in. ${complete}`;
  }

  revalidatePath("/warehouse");
  revalidatePath("/install");
  if (mail) {
    redirect(warehousePath(jobNumber, mail));
  }
}

export async function saveBrokenOpening(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const jobNumber = String(formData.get("jobNumber") ?? "");
  const openingKey = String(formData.get("openingKey") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const photoPath = String(formData.get("photoPath") ?? "").trim() || null;
  const photoName = String(formData.get("photoName") ?? "").trim() || null;
  if (!jobId || !openingKey) {
    redirect(warehousePath(jobNumber, "Missing opening."));
  }

  const db = raw(await createClient());
  const { error } = await db.from("warehouse_checkins").upsert(
    {
      org_id: activeOrg.id,
      job_id: jobId,
      opening_key: openingKey,
      broken: true,
      note: note || null,
      photo_path: photoPath,
      photo_name: photoName,
      received_by: user.email ?? user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,job_id,opening_key" },
  );
  if (error) redirect(warehousePath(jobNumber, error.message));
  revalidatePath("/warehouse");
  redirect(warehousePath(jobNumber, "Broken window note saved."));
}
