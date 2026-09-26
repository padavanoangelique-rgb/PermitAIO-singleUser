"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTechLabel } from "@/components/tech-slots-provider";

// Same type-erasure cast the notification bell uses: `notifications` isn't in the generated types.
function notificationsTable(supabase: ReturnType<typeof createClient>) {
  return (supabase as unknown as { from: (t: string) => any }).from("notifications");
}

type Row = {
  id: string;
  job_id: string | null;
  permit_tech: string | null;
  source: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

type Item = {
  key: string;
  ids: string[];
  jobId: string | null;
  source: string;
  message: string;
  createdAt: string;
  unread: boolean;
  count: number;
};

type Group = { key: string; label: string; items: Item[]; unread: number };

const COLUMNS = "id, job_id, permit_tech, source, message, read_at, created_at";
const PREVIEW_COUNT = 8;
const OPEN_KEY = "paio-agent-inbox-open";

const SOURCE_LABEL: Record<string, string> = {
  email_agent: "Email",
  permits_agent: "Permits dept",
  sheet_agent: "Sheet",
  data_agent: "Data",
  bulk_agent: "Bulk update",
  intake_agent: "New job",
  team_request: "Request",
  install_assign: "Install",
  runner_assign: "Runner",
  job_task_assign: "Task",
};

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Identical notifications for the same job (e.g. the same sheet update repeated) show once, with a count. */
function collapse(rows: Row[]): Item[] {
  const byKey = new Map<string, Item>();
  for (const row of rows) {
    const key = `${row.job_id ?? ""}|${row.source}|${row.message}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.ids.push(row.id);
      existing.count += 1;
      if (!row.read_at) existing.unread = true;
    } else {
      byKey.set(key, {
        key,
        ids: [row.id],
        jobId: row.job_id,
        source: row.source,
        message: row.message,
        createdAt: row.created_at,
        unread: !row.read_at,
        count: 1,
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Agent inbox on the dashboard: everything the agents (Email, Sheet, Data, Permits, Bulk, Intake…)
 * reported. A tech sees only their own (their permit/HOA tech notifications plus anything addressed
 * to them directly); a manager sees every tech's, split per tech. Collapsible; identical repeats are
 * grouped; each item can be dismissed for good.
 */
export function AgentInbox({
  orgId,
  userId,
  isManager,
  permitTechLabel,
  hoaTechLabel,
  permitTechSlots,
  hoaTechSlots,
}: {
  orgId: string;
  userId: string;
  isManager: boolean;
  permitTechLabel: string | null;
  hoaTechLabel: string | null;
  permitTechSlots: readonly string[];
  hoaTechSlots: readonly string[];
}) {
  const { permitLabel, hoaLabel } = useTechLabel();
  const [rows, setRows] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Record<string, { job_number: string; client_name: string }>>({});
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(true);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OPEN_KEY);
      if (saved === "0") setOpen(false);
    } catch {
      /* storage unavailable: stay open */
    }
  }, []);

  function toggleOpen() {
    setOpen((cur) => {
      const next = !cur;
      try {
        window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    let data: Row[] = [];
    if (isManager) {
      const res = await notificationsTable(supabase)
        .select(COLUMNS)
        .eq("org_id", orgId)
        .neq("source", "user_message")
        .order("created_at", { ascending: false })
        .limit(400);
      data = (res.data ?? []) as Row[];
    } else {
      const labels = [permitTechLabel, hoaTechLabel].filter((v): v is string => Boolean(v));
      const [direct, byTech] = await Promise.all([
        notificationsTable(supabase)
          .select(COLUMNS)
          .eq("org_id", orgId)
          .eq("recipient_user_id", userId)
          .neq("source", "user_message")
          .order("created_at", { ascending: false })
          .limit(200),
        labels.length
          ? notificationsTable(supabase)
              .select(COLUMNS)
              .eq("org_id", orgId)
              .in("permit_tech", labels)
              .neq("source", "user_message")
              .order("created_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [] as Row[] }),
      ]);
      const merged = new Map<string, Row>();
      for (const row of [...(direct.data ?? []), ...(byTech.data ?? [])] as Row[]) merged.set(row.id, row);
      data = Array.from(merged.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    setRows(data);

    const jobIds = Array.from(new Set(data.map((r) => r.job_id).filter((v): v is string => Boolean(v))));
    if (jobIds.length) {
      const { data: jobRows } = await supabase
        .from("jobs")
        .select("id, job_number, client_name")
        .in("id", jobIds.slice(0, 200));
      const map: Record<string, { job_number: string; client_name: string }> = {};
      for (const j of jobRows ?? []) map[j.id] = { job_number: String(j.job_number ?? ""), client_name: String(j.client_name ?? "") };
      setJobs(map);
    }
    setLoaded(true);
  }, [isManager, orgId, userId, permitTechLabel, hoaTechLabel]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const groups: Group[] = useMemo(() => {
    const items = collapse(rows);
    const nameFor = (key: string) => {
      if (!key) return "Unassigned";
      if (hoaTechSlots.includes(key) && !permitTechSlots.includes(key)) return hoaLabel(key) || key;
      return permitLabel(key) || key;
    };
    if (!isManager) {
      return [{ key: "mine", label: "Your notifications", items, unread: items.filter((i) => i.unread).length }];
    }
    const byTech = new Map<string, Row[]>();
    for (const row of rows) {
      const k = row.permit_tech ?? "";
      byTech.set(k, [...(byTech.get(k) ?? []), row]);
    }
    const order = [...permitTechSlots, ...hoaTechSlots];
    const keys = Array.from(byTech.keys()).sort((a, b) => {
      if (a === "") return 1;
      if (b === "") return -1;
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
    });
    return keys.map((k) => {
      const groupItems = collapse(byTech.get(k) ?? []);
      return { key: k || "unassigned", label: nameFor(k), items: groupItems, unread: groupItems.filter((i) => i.unread).length };
    });
  }, [rows, isManager, permitTechSlots, hoaTechSlots, permitLabel, hoaLabel]);

  const totalUnread = groups.reduce((sum, g) => sum + g.unread, 0);
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  async function dismiss(ids: string[]) {
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    const supabase = createClient();
    const { error } = await notificationsTable(supabase).delete().in("id", ids);
    if (error) {
      console.error("agent inbox: could not delete notifications", error);
      void load();
    }
  }

  async function markRead(ids: string[]) {
    const stamp = new Date().toISOString();
    setRows((prev) => prev.map((r) => (ids.includes(r.id) && !r.read_at ? { ...r, read_at: stamp } : r)));
    const supabase = createClient();
    await notificationsTable(supabase).update({ read_at: stamp }).in("id", ids);
  }

  const noIdentity = !isManager && !permitTechLabel && !hoaTechLabel;

  return (
    <Card className="overflow-hidden print:hidden">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Agent inbox</span>
          {loaded && totalUnread > 0 ? (
            <Badge variant="destructive" className="text-[10px]">
              {totalUnread} new
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {loaded ? (totalItems === 0 ? "Nothing waiting" : `${totalItems} item${totalItems === 1 ? "" : "s"}`) : "Loading…"}
          </span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <div className="border-t">
          {noIdentity && totalItems === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Set which tech you are in Settings to see your agent notifications here.
            </p>
          )}
          {loaded && totalItems === 0 && !noIdentity && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No agent notifications right now.</p>
          )}

          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => {
              const isOpen = !isManager || (groupOpen[g.key] ?? g.unread > 0);
              const list = showAll[g.key] ? g.items : g.items.slice(0, PREVIEW_COUNT);
              return (
                <div key={g.key} className="border-b last:border-b-0">
                  {isManager ? (
                    <div className="flex items-center justify-between gap-2 px-4 py-2">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-medium"
                        onClick={() => setGroupOpen((cur) => ({ ...cur, [g.key]: !isOpen }))}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {g.label}
                        <span className="text-xs font-normal text-muted-foreground">
                          {g.items.length} item{g.items.length === 1 ? "" : "s"}
                        </span>
                        {g.unread > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            {g.unread} new
                          </Badge>
                        )}
                      </button>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        {g.unread > 0 && (
                          <button
                            type="button"
                            className="underline-offset-2 hover:text-foreground hover:underline"
                            onClick={() => void markRead(g.items.flatMap((i) => i.ids))}
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          className="underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => void dismiss(g.items.flatMap((i) => i.ids))}
                        >
                          Clear all
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-3 px-4 pt-2 text-xs text-muted-foreground">
                      {g.unread > 0 && (
                        <button
                          type="button"
                          className="underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => void markRead(g.items.flatMap((i) => i.ids))}
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        className="underline-offset-2 hover:text-foreground hover:underline"
                        onClick={() => void dismiss(g.items.flatMap((i) => i.ids))}
                      >
                        Clear all
                      </button>
                    </div>
                  )}

                  {isOpen && (
                    <ul className="divide-y">
                      {list.map((item) => {
                        const job = item.jobId ? jobs[item.jobId] : undefined;
                        return (
                          <li key={item.key} className="flex items-start justify-between gap-3 px-4 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {item.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                                <Badge variant="secondary" className="text-[10px]">
                                  {SOURCE_LABEL[item.source] ?? item.source}
                                </Badge>
                                {item.jobId ? (
                                  <Link
                                    href={`/jobs/${item.jobId}`}
                                    className="text-xs font-medium text-primary hover:underline"
                                    onClick={() => void markRead(item.ids)}
                                  >
                                    {job ? `Job ${job.job_number}${job.client_name ? ` — ${job.client_name}` : ""}` : "Open job"}
                                  </Link>
                                ) : null}
                                {item.count > 1 && <span className="text-xs text-muted-foreground">×{item.count}</span>}
                                <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                              </div>
                              <p className="mt-0.5 break-words text-sm">{item.message}</p>
                            </div>
                            <button
                              type="button"
                              aria-label="Dismiss"
                              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => void dismiss(item.ids)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {isOpen && g.items.length > PREVIEW_COUNT && (
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAll((cur) => ({ ...cur, [g.key]: !cur[g.key] }))}
                    >
                      {showAll[g.key] ? "Show fewer" : `Show all ${g.items.length}`}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </Card>
  );
}
