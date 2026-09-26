"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { notify } from "@/lib/notifications/notify";
import type { ActionResult } from "@/lib/actions/auth";

function jobTasksTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return (supabase as unknown as { from: (t: string) => any }).from("job_tasks");
}

export async function createJobTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();

const jobId = String(formData.get("jobId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "") || null;

if (!jobId) return { error: "Missing job." };
  if (!title) return { error: "Give the task a title." };

const supabase = await createClient();

if (assignedTo) {
  const { data: member } = await supabase
  .from("organization_members")
  .select("user_id")
  .eq("org_id", activeOrg.id)
  .eq("user_id", assignedTo)
  .maybeSingle();
  if (!member) return { error: "That person isn't on this team." };
}

const { error } = await jobTasksTable(supabase).insert({
  org_id: activeOrg.id,
  job_id: jobId,
  title,
  assigned_to: assignedTo,
  created_by: user.id,
});
  if (error) return { error: error.message };

if (assignedTo && assignedTo !== user.id) {
  const author =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    user.email?.split("@")[0] ||
    user.email ||
    "A teammate";
  await notify({
    orgId: activeOrg.id,
    jobId,
    permitTech: null,
    source: "job_task_assign",
    message: `${author} assigned you a task: ${title}`,
    requestedBy: user.id,
    recipientUserId: assignedTo,
  });
}

revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/** Toggles done/open server-side off the row's current state, rather than
* trusting a client-passed boolean — avoids the button and the DB ever
* disagreeing about which state it's toggling from. */
export async function toggleJobTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const taskId = String(formData.get("taskId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (!taskId || !jobId) return { error: "Missing task." };

const supabase = await createClient();
  const { data: task } = await jobTasksTable(supabase)
  .select("done_at")
  .eq("id", taskId)
  .eq("org_id", activeOrg.id)
  .maybeSingle();
  if (!task) return { error: "Task not found." };

const { error } = await jobTasksTable(supabase)
  .update({ done_at: task.done_at ? null : new Date().toISOString() })
  .eq("id", taskId)
  .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };

revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/** "Ask for update" on a task — the exact same team_request shape
* Sales/Install already use to ask a tech for a job update, just addressed
* at a task's assignee instead. The recipient's reply routes back through
* the existing replyToNotification path with no new code. */
export async function requestJobTaskUpdate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const taskId = String(formData.get("taskId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (!taskId || !jobId) return { error: "Missing task." };

const supabase = await createClient();
  const { data: task } = await jobTasksTable(supabase)
  .select("id, title, assigned_to")
  .eq("id", taskId)
  .eq("org_id", activeOrg.id)
  .maybeSingle();
  if (!task) return { error: "Task not found." };
  if (!task.assigned_to) return { error: "Assign this task to someone first." };

const author =
  (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
  user.email?.split("@")[0] ||
  user.email ||
  "A teammate";

await notify({
  orgId: activeOrg.id,
  jobId,
  permitTech: null,
  source: "team_request",
  message: `${author} asked for an update on: ${task.title}`,
  requestedBy: user.id,
  recipientUserId: task.assigned_to,
});

return { error: null };
}
