"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { notify } from "./notify";
import type { ActionResult } from "@/lib/actions/auth";

export type Teammate = {
  userId: string;
  name: string;
};

export type ChatMessage = {
  fromMe: boolean;
  text: string;
  createdAt: string;
};

/** The active org's roster, for a teammate picker — same
* organization_members → profiles join settings/page.tsx uses for the
* member list, scoped to the current org via RLS. Excludes the caller by
* default (you can't message yourself); pass includeSelf for pickers where
* assigning something to yourself is valid, like a job task. */
export async function listTeammates({ includeSelf = false }: { includeSelf?: boolean } = {}): Promise<Teammate[]> {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

const { data: members } = await supabase
  .from("organization_members")
  .select("user_id")
  .eq("org_id", activeOrg.id);

const memberIds = (members ?? [])
  .map((m) => m.user_id)
  .filter((id) => includeSelf || id !== user.id);
  if (memberIds.length === 0) return [];

const { data: profiles } = await supabase
  .from("profiles")
  .select("id, email, full_name")
  .in("id", memberIds);

return (profiles ?? [])
  .map((p) => ({
    userId: p.id,
    name: (p.full_name?.trim() || p.email || "Teammate") + (p.id === user.id ? " (you)" : ""),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
}

/** A teammate messaging another teammate directly — not tied to a job or
* triggered by an agent. See the "user_message" case in notify.ts for why
* this is repliable for free through the existing reply-to-notification
* path. */
export async function sendTeammateMessage(
  _prev: ActionResult,
  formData: FormData,
  ): Promise<ActionResult> {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();

const recipientUserId = String(formData.get("recipientUserId") ?? "");
  const message = String(formData.get("message") ?? "").trim();

if (!recipientUserId) return { error: "Choose a teammate." };
  if (!message) return { error: "Write a message first." };
  if (recipientUserId === user.id) return { error: "You can't message yourself." };

const supabase = await createClient();
  const { data: recipient } = await supabase
  .from("organization_members")
  .select("user_id")
  .eq("org_id", activeOrg.id)
  .eq("user_id", recipientUserId)
  .maybeSingle();
  if (!recipient) return { error: "That person isn't on this team." };

const author =
  (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
  user.email?.split("@")[0] ||
  user.email ||
  "A teammate";

await notify({
  orgId: activeOrg.id,
  jobId: null,
  permitTech: null,
  source: "user_message",
  message: `${author}: ${message}`,
  requestedBy: user.id,
  recipientUserId,
});

return { error: null };
}

/** The full back-and-forth with one teammate, oldest first. A reply keeps
* its parent's source (see replyToNotification), so both directions of a
* "user_message" conversation share that one source and can be read as a
* single thread — one query per direction, merged and sorted.
*
* Uses the admin client rather than the RLS-scoped one: RLS on
* `notifications` is proven (by the bell) to allow reading rows addressed
* to you, but nothing today reads rows addressed *away* from you (the
* messages you sent), so whether that's also permitted is unverified. The
* authorization boundary is enforced here in code instead — every row
* fetched is required to have the caller as either sender or recipient. */
export async function getConversation(otherUserId: string): Promise<ChatMessage[]> {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const admin = createAdminClient();
  const table = (admin as unknown as { from: (t: string) => any }).from("notifications");

const [sent, received] = await Promise.all([
  table
  .select("message, created_at")
  .eq("org_id", activeOrg.id)
  .eq("source", "user_message")
  .eq("requested_by", user.id)
  .eq("recipient_user_id", otherUserId),
  table
  .select("message, created_at")
  .eq("org_id", activeOrg.id)
  .eq("source", "user_message")
  .eq("requested_by", otherUserId)
  .eq("recipient_user_id", user.id),
  ]);

const strip = (message: string) => {
  const i = message.indexOf(": ");
  return i === -1 ? message : message.slice(i + 2);
};

const rows = [
  ...((sent.data ?? []) as { message: string; created_at: string }[]).map((r) => ({
    fromMe: true,
    text: strip(r.message),
    createdAt: r.created_at,
  })),
  ...((received.data ?? []) as { message: string; created_at: string }[]).map((r) => ({
    fromMe: false,
    text: strip(r.message),
    createdAt: r.created_at,
  })),
  ];

return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); } export async function getUnreadMessageCount(): Promise<number> { const user = await requireUser(); const { activeOrg } = await requireActiveOrg(); const admin = createAdminClient(); const table = (admin as unknown as { from: (t: string) => any }).from("notifications"); const { count } = await table.select("id", { count: "exact", head: true }).eq("org_id", activeOrg.id).eq("source", "user_message").eq("recipient_user_id", user.id).is("read_at", null); return count ?? 0; } export async function markMessagesRead(otherUserId: string): Promise<void> { const user = await requireUser(); const { activeOrg } = await requireActiveOrg(); const admin = createAdminClient(); const table = (admin as unknown as { from: (t: string) => any }).from("notifications"); await table.update({ read_at: new Date().toISOString() }).eq("org_id", activeOrg.id).eq("source", "user_message").eq("recipient_user_id", user.id).eq("requested_by", otherUserId).is("read_at", null); }
