"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { replyToNotification } from "@/lib/notifications/reply-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The generated Supabase types don't yet know about `notifications` (added
// by a migration run directly, not via codegen) — same type-erasure cast
// every other agent uses server-side for tables outside the generated set.
function notificationsTable(supabase: ReturnType<typeof createClient>) {
  return (supabase as unknown as { from: (t: string) => any }).from("notifications");
}

interface NotificationRow {
  id: string;
  job_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
  requested_by: string | null; }

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function ReplyRow({ notificationId }: { notificationId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

if (sent) {
  return <p className="mt-1.5 text-xs text-muted-foreground">Reply sent.</p>
}
  if (!open) {
    return (
      <button
        type="button"
        className="mt-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        >
      Reply
      </button>
      );
  }
  return (
    <form
      action={replyToNotification}
      className="mt-1.5 flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onSubmit={() => setSent(true)}
      >
    <input type="hidden" name="notificationId" value={notificationId} />
    <input
      type="text"
      name="replyMessage"
      placeholder="Reply with the update…"
      autoFocus
      className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      />
    <button
      type="submit"
      className="h-7 shrink-0 rounded bg-primary px-2 text-xs font-medium text-primary-foreground"
      onPointerDown={(e) => e.stopPropagation()}
      >
    Send
    </button>
    </form>
    );
      }
    
    /**
    * Every agent — Data Agent, Permits Agent, the rest — reports to the same
    * `notifications` table via src/lib/notifications/notify.ts. This is the
    * one place that surfaces it: rows matched to the current user's own
    * claimed permit_tech identity (set on the Settings page), plus any reply
    * addressed to them directly by user id (a tech replying to a Sales/Install
    * "request update" isn't routed by tech identity — the requester usually
    * isn't a tech).
    */
    export function NotificationBell({
      orgId,
      permitTech,
      userId,
    }: {
      orgId: string;
    permitTech: string | null;
    userId: string;
      }) {
        const [rows, setRows] = useState<NotificationRow[]>([]);
    const [loaded, setLoaded] = useState(false);
    
    useEffect(() => {
      let cancelled = false;
    const supabase = createClient();
    const columns = "id, job_id, message, read_at, created_at, requested_by";

    function load() {
    
    const byRecipient = notificationsTable(supabase).select(columns).eq("org_id", orgId).eq("recipient_user_id", userId).neq("source", "user_message").order("created_at", { ascending: false }).limit(20);
    const byPermitTech = permitTech ? notificationsTable(supabase).select(columns).eq("org_id", orgId).eq("permit_tech", permitTech).neq("source", "user_message").order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] as NotificationRow[] });
    
    Promise.all([byRecipient, byPermitTech]).then(([recipientRes, techRes]) => {
      if (cancelled) return;
    const merged = new Map<string, NotificationRow>();
    for (const row of [...(recipientRes.data ?? []), ...(techRes.data ?? [])] as NotificationRow[]) {
      merged.set(row.id, row);
      }
    const sorted = Array.from(merged.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);
    setRows(sorted);
      setLoaded(true);
    });
    }

    load();
    const interval = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orgId, permitTech, userId]);
    
    const unreadCount = rows.filter((r) => !r.read_at).length;
    
    async function markAllRead() {
      if (unreadCount === 0) return;
    const supabase = createClient();
    const unreadIds = rows.filter((r) => !r.read_at).map((r) => r.id);
    setRows((prev) => prev.map((r) => (r.read_at ? r : { ...r, read_at: new Date().toISOString() })));
    await notificationsTable(supabase).update({ read_at: new Date().toISOString() }).in("id", unreadIds);
      }
    
    async function clearOne(id: string) { const supabase = createClient();
    setRows((prev) => prev.filter((r) => r.id !== id));
    const { error } = await notificationsTable(supabase).delete().eq("id", id);
    if (error) console.error("clearOne: failed to delete notification", error);
      }
    
    async function clearAll() { if (rows.length === 0) return; const supabase = createClient(); const ids = rows.map((r) => r.id); setRows([]);
    const { error } = await notificationsTable(supabase).delete().in("id", ids);
    if (error) console.error("clearAll: failed to delete notifications", error);
      }
    
    return (
    <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
    <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
    <Bell className="h-4 w-4" />
      {loaded && unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px] leading-none"
          >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
    )}
    </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-80">
    <div className="flex items-center justify-between px-2 py-1.5">
    <DropdownMenuLabel className="p-0">
    Notifications{permitTech ? ` — ${permitTech}` : ""}
    </DropdownMenuLabel>
      {rows.length > 0 && (
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            clearAll();
          }}
          >
        Clear all
        </button> )} </div> <DropdownMenuSeparator />
      {rows.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing yet.</p>}
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-start justify-between gap-2 border-b px-2 py-2 last:border-b-0"
          >
        <div className="flex flex-1 flex-col items-start gap-0.5">
          {row.job_id ? (
            <a href={`/jobs/${row.job_id}`} className="text-sm hover:underline">
              {row.message}
            </a>
            ) : (
            <span className="text-sm">{row.message}</span>
        )}
        <span className="text-xs text-muted-foreground">{timeAgo(row.created_at)}</span>
          {row.requested_by ? <ReplyRow notificationId={row.id} /> : null}
        </div>
        <button
          type="button"
          aria-label="Clear notification"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            clearOne(row.id);
          }}
          >
        <X className="h-3.5 w-3.5" />
        </button> </div>
        ))}
    </DropdownMenuContent>
    </DropdownMenu>
    );
      }
