"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { notify, type NotificationSource } from "./notify";

type NotificationRow = {
  id: string;
  org_id: string;
  job_id: string | null;
  requested_by: string | null;
  source: NotificationSource;
};

function notificationsTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: NotificationRow | null }> };
      };
    };
  };
}

/**
* A tech replying, from their own bell, to a "request update" notification.
* Writes the reply as a job_activity note (so it shows up the next time
* anyone pulls the job), then notifies the original requester directly by
* user id — not by permit_tech identity, since the requester (Sales,
* Account Manager, Install Manager) usually isn't a tech.
*/
export async function replyToNotification(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const notificationId = String(formData.get("notificationId") ?? "");
  const replyMessage = String(formData.get("replyMessage") ?? "").trim();
  if (!notificationId || !replyMessage) return;

const supabase = await createClient();
  const { data: original } = await notificationsTable(supabase)
  .from("notifications")
  .select("id, org_id, job_id, requested_by, source")
  .eq("id", notificationId)
  .maybeSingle();

if (!original || original.org_id !== activeOrg.id || !original.requested_by) return;

const author =
  (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
  user.email?.split("@")[0] ||
  user.email ||
  "Tech";

const message = `${author} replied: ${replyMessage}`;

if (original.job_id) {
  await supabase.from("job_activity").insert({
    org_id: activeOrg.id,
    job_id: original.job_id,
    user_id: user.id,
    activity_type: "note",
    message,
  });
}

await notify({
  orgId: activeOrg.id,
  jobId: original.job_id,
  permitTech: null,
  source: original.source ?? "team_request",
  message,
  recipientUserId: original.requested_by,
  parentId: original.id,
});

revalidatePath("/sales");
  revalidatePath("/install/status");
}
