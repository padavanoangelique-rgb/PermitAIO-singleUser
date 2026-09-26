"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg, canManageOrg } from "@/lib/data/orgs";
import { notify } from "@/lib/notifications/notify";
import { recordAssignedRole } from "@/lib/record-assigned-role";
import { loadTicketPhotoPaths, saveAssignment, saveTicket, createServiceRequest, setRouteOrder } from "@/lib/service/store";

type ServiceRole = "service_manager" | "service_tech";

function raw(supabase: Awaited<ReturnType<typeof createClient>>) {
    return supabase as unknown as {
          from: (table: string) => {
                  select: (cols: string) => {
                            eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> & {
                                        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
                            };
                  };
                  insert: (row: Record<string, unknown>) => {
                    select: (c: string) => {
                      single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
                    };
                  } & Promise<{ error: { message: string } | null }>;
                  delete: () => {
                    eq: (c: string, v: string) => {
                      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
                    };
                  };
          };
    };
}

async function memberInfo(supabase: Awaited<ReturnType<typeof createClient>>, id: string | null) {
    if (!id) return null;
    const { data } = await raw(supabase)
      .from("service_members")
      .select("user_id, display_name, email")
      .eq("id", id)
      .maybeSingle();
    return data as { user_id: string | null; display_name: string | null; email: string } | null;
}

export async function addJobToServiceBoard(formData: FormData) {
    const user = await requireUser();
    const { activeOrg } = await requireActiveOrg();
    const jobId = String(formData.get("jobId") ?? "");
    if (!jobId) {
          redirect("/service?mail=" + encodeURIComponent("Pick a job number."));
    }

  const supabase = await createClient();
    const { data: job } = await supabase
      .from("jobs")
      .select("id, job_number")
      .eq("org_id", activeOrg.id)
      .eq("id", jobId)
      .maybeSingle();

  if (!job) {
        redirect("/service?mail=" + encodeURIComponent("That job number is not in PermitAIO."));
  }

  const error = await saveAssignment(supabase, activeOrg.id, user.id, {
        job_id: job.id,
        job_number: job.job_number,
        assigned_by: user.id,
        status: "open",
  });
    if (error) {
          redirect("/service?mail=" + encodeURIComponent(error));
    }
    revalidatePath("/service");
    redirect("/service?mail=" + encodeURIComponent(`Added ${job.job_number} to the service board.`));
}

export async function addServiceMember(formData: FormData) {
    const user = await requireUser();
    const { activeOrg } = await requireActiveOrg();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "") as ServiceRole;
    const displayName = String(formData.get("displayName") ?? "").trim() || null;
    const companyName = String(formData.get("companyName") ?? "").trim() || null;
    const next = String(formData.get("next") ?? "/service");
    const bounce = (msg: string) => {
          const path = next.startsWith("/") ? next : "/service";
          const sep = path.includes("?") ? "&" : "?";
          redirect(`${path}${sep}mail=` + encodeURIComponent(msg));
    };
    if (!email || !email.includes("@") || !role) {
          bounce("Enter a valid email.");
    }

  const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
    const { error } = await raw(supabase).from("service_members").insert({
          org_id: activeOrg.id,
          email,
          role,
          display_name: displayName,
          company_name: companyName,
          user_id: profile?.id ?? null,
          invited_by: user.id,
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
          bounce(error.message);
    }
    await recordAssignedRole(activeOrg.id, email, role);
    revalidatePath("/service");
    revalidatePath("/settings");
    const who = displayName || email;
    if (profile?.id) {
          bounce(`${who} is on the service roster. They go to permitaio.com/join, enter the company code, and create a password.`);
    }
    bounce(`Added ${who}. They go to permitaio.com/join, enter your company code, and create their own password.`);
}

export async function removeServiceMember(formData: FormData) {
    const { activeOrg, role } = await requireActiveOrg();
    if (!canManageOrg(role)) return;
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await raw(await createClient()).from("service_members").delete().eq("id", id).eq("org_id", activeOrg.id);
    revalidatePath("/service");
    revalidatePath("/settings");
}

export async function assignServiceJob(formData: FormData) {
    const user = await requireUser();
    const { activeOrg } = await requireActiveOrg();
    const jobId = String(formData.get("jobId") ?? "");
    const jobNumber = String(formData.get("jobNumber") ?? "");
    const serviceTechId = String(formData.get("serviceTechId") ?? "") || null;
    const scheduledDate = String(formData.get("scheduledDate") ?? "") || null;
    const scheduledStartTime = String(formData.get("scheduledStartTime") ?? "") || null;
    const scheduledEndTime = String(formData.get("scheduledEndTime") ?? "") || null;
    const statusIn = String(formData.get("status") ?? "") || null;
    if (!jobId || !jobNumber) return;

  const supabase = await createClient();
    const error = await saveAssignment(supabase, activeOrg.id, user.id, {
          job_id: jobId,
          job_number: jobNumber,
          service_tech_id: serviceTechId,
          scheduled_date: scheduledDate,
          scheduled_start_time: scheduledStartTime,
          scheduled_end_time: scheduledEndTime,
          status: statusIn || undefined,
          assigned_by: user.id,
    });
    if (error) {
          redirect("/service?mail=" + encodeURIComponent(error));
    }
    if (serviceTechId) {
          const tech = await memberInfo(supabase, serviceTechId);
          if (tech?.user_id) {
                  await notify({
                            orgId: activeOrg.id,
                            jobId,
                            permitTech: null,
                            source: "install_assign",
                            message: `You were assigned to service job ${jobNumber}.`,
                            recipientUserId: tech.user_id,
                  });
          }
    }
    revalidatePath("/service");
    redirect("/service?mail=" + encodeURIComponent(`Saved ${jobNumber}.`));
}

export async function updateServiceRoute(formData: FormData) {
    const { activeOrg } = await requireActiveOrg();
    const jobId = String(formData.get("jobId") ?? "");
    if (!jobId) return;
    const orderRaw = String(formData.get("order") ?? "");
    const order = orderRaw === "" ? null : Number(orderRaw);
    const supabase = await createClient();
    await setRouteOrder(supabase, activeOrg.id, jobId, Number.isFinite(order as number) ? (order as number) : null);
    revalidatePath("/service");
}

export async function requestService(formData: FormData) {
    const user = await requireUser();
    const { activeOrg } = await requireActiveOrg();
    const next = String(formData.get("next") ?? "/service?app=request");
    const bounce = (msg: string) => {
          const path = next.startsWith("/") ? next : "/service?app=request";
          const sep = path.includes("?") ? "&" : "?";
          redirect(`${path}${sep}mail=` + encodeURIComponent(msg));
    };

  const isNewJob = String(formData.get("isNewJob") ?? "") === "on";
    const jobNumber = String(formData.get("jobNumber") ?? "").trim();
    const clientName = String(formData.get("clientName") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const issueDescription = String(formData.get("issueDescription") ?? "").trim();
    const priority = String(formData.get("priority") ?? "routine");
    const requestSource = String(formData.get("requestSource") ?? "service");
    const requestedDate = String(formData.get("requestedDate") ?? "") || null;

  if (!jobNumber) bounce("Enter a job number.");
    if (issueDescription.length < 3) bounce("Describe what the job needs.");

  const supabase = await createClient();
    let jobId = "";
    let finalJobNumber = jobNumber;

  if (isNewJob) {
        if (!clientName) bounce("Enter the client name for the new job.");
        const insertRes = await raw(supabase)
          .from("jobs")
          .insert({
                    org_id: activeOrg.id,
                    created_by: user.id,
                    client_name: clientName,
                    job_number: jobNumber,
                    address: address || null,
                    city: city || null,
                    trade_type: "Service",
                    stage: "Service",
                    sub_status: "Service",
                    permit_tech: "Permit Tech 1",
                    is_service_only: true,
          })
          .select("id")
          .single();
        if (insertRes.error || !insertRes.data) {
                bounce(insertRes.error?.message ?? "Could not create that job.");
        }
        jobId = String((insertRes.data as { id: string }).id);
  } else {
        // Forgiving lookup: ignore capitalisation, then fall back to job numbers that start with what was typed
        // (so "84489" finds "84489-1"). Several matches ask for the full number instead of guessing.
        const like = jobNumber.replace(/[\\%_]/g, (c) => "\\" + c);
        let { data: found } = await supabase
          .from("jobs")
          .select("id, job_number")
          .eq("org_id", activeOrg.id)
          .ilike("job_number", like)
          .limit(2);
        if (!found || found.length === 0) {
                ({ data: found } = await supabase
                  .from("jobs")
                  .select("id, job_number")
                  .eq("org_id", activeOrg.id)
                  .ilike("job_number", `${like}%`)
                  .limit(6));
        }
        if (!found || found.length === 0) {
                bounce(`"${jobNumber}" is not in PermitAIO yet. Check "not in PermitAIO yet" to add it.`);
        }
        if ((found ?? []).length > 1) {
                bounce(`More than one job matches "${jobNumber}": ${(found ?? []).map((j) => j.job_number).join(", ")}. Enter the full job number.`);
        }
        const job = (found ?? [])[0];
        jobId = String((job as { id: string }).id);
        finalJobNumber = String((job as { job_number: string }).job_number);
  }

  const error = await createServiceRequest(supabase, activeOrg.id, user.id, {
        job_id: jobId,
        job_number: finalJobNumber,
        issue_description: issueDescription,
        priority,
        requested_by_name: user.email ?? null,
        request_source: requestSource,
        requested_date: requestedDate,
  });
    if (error) {
          bounce(error);
    }
    revalidatePath("/service");
    bounce(`Service requested for ${finalJobNumber}.`);
}

export async function submitServiceTicket(formData: FormData) {
    const user = await requireUser();
    const { activeOrg } = await requireActiveOrg();
    const jobId = String(formData.get("jobId") ?? "");
    const jobNumber = String(formData.get("jobNumber") ?? "");
    const serviceTechId = String(formData.get("serviceTechId") ?? "") || null;
    const issue = String(formData.get("issue") ?? "").trim();
    if (!jobId || !jobNumber) {
          redirect("/service?app=tech&mail=" + encodeURIComponent("Missing job number."));
    }
    if (issue.length < 3) {
          redirect("/service?app=tech&mail=" + encodeURIComponent("Write the issue before you submit the ticket."));
    }

  const supabase = await createClient();
    const already = await loadTicketPhotoPaths(supabase, activeOrg.id, jobId);

  const files = await supabase
      .from("job_files")
      .select("storage_path")
      .eq("org_id", activeOrg.id)
      .eq("job_id", jobId)
      .eq("category", "service_photo");
    const photoPaths = ((files.data ?? []) as { storage_path: string }[])
      .map((f) => f.storage_path)
      .filter((p) => !already.has(p));

  const error = await saveTicket(supabase, activeOrg.id, user.id, {
        job_id: jobId,
        job_number: jobNumber,
        service_tech_id: serviceTechId,
        issue,
        photo_paths: photoPaths,
  });
    if (error) {
          redirect("/service?app=tech&mail=" + encodeURIComponent(error));
    }

  revalidatePath("/service");
    revalidatePath("/service/reports");
    redirect("/service?app=tech&mail=" + encodeURIComponent(`Ticket submitted on ${jobNumber}.`));
}
