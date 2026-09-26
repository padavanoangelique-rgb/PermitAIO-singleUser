import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

export type NotificationSource =
  | "data_agent"
| "permits_agent"
| "bulk_agent"
| "intake_agent"
| "sheet_agent"
| "email_agent"
| "team_request"
| "install_assign"
| "runner_assign"
| "user_message"
| "job_task_assign"
  | "permit_scout";

/**
* One shared entry point every agent write-path calls right next to its
* job_activity insert — this is the whole notification system's fan-in, so
* "everything the bot does triggers a notification" only has to be true
* here, not re-implemented per agent. A human "Request update" click from
* Sales or Install goes through here too, under the "team_request" source.
* "install_assign" covers a person being assigned, scheduled, or handed a
* job on the Install board — always addressed with `recipientUserId`
* rather than `permitTech`, since installers/PMs/account managers aren't
* permit-tech identities. "runner_assign" is the same idea for the Permit
* Runner module — a tech handing the runner a job to carry between offices.
* "user_message" is a teammate messaging another teammate directly (see
* src/lib/notifications/compose-actions.ts) — no job, no agent, just two
* people; it's addressed with `recipientUserId` and sets `requestedBy` to
* the sender so the recipient's reply routes back through the same
* replyToNotification path a "request update" reply already uses.
* "job_task_assign" is a job-attached task (src/lib/job-tasks/actions.ts)
* landing on whoever it's assigned to; asking for an update on an existing
* task reuses "team_request" rather than a source of its own, since that's
* the exact same "someone wants a status update, addressed to a person,
* repliable" shape Sales/Install already use.
*
* `requestedBy` records who asked for an update, so the tech's reply (via
* replyToNotification) knows who to notify back. `recipientUserId` is the
* inverse — set on a reply row to address a specific person directly
* instead of routing by permit_tech identity. `parentId` links a reply back
* to the request it answers.
*/
export async function notify(input: {
  orgId: string;
  jobId: string | null;
  permitTech: string | null;
  source: NotificationSource;
  message: string;
  requestedBy?: string | null;
  recipientUserId?: string | null;
  parentId?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await adminTable(admin, "notifications").insert({
    org_id: input.orgId,
    job_id: input.jobId,
    permit_tech: input.permitTech,
    source: input.source,
    message: input.message,
    requested_by: input.requestedBy ?? null,
    recipient_user_id: input.recipientUserId ?? null,
    parent_id: input.parentId ?? null,
  });
}
