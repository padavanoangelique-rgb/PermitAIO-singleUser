"use client";

import { useMemo, useState, useTransition } from "react";
import type { AdminUserRow } from "@/lib/data/platform-users";
import { setPlatformAdmin } from "@/lib/actions/platform-admins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeDate(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function UsersTable({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      if (u.email?.toLowerCase().includes(q)) return true;
      if (u.full_name?.toLowerCase().includes(q)) return true;
      if (u.memberships.some((m) => m.org_name.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [users, query]);

  function toggleAdmin(user: AdminUserRow) {
    setError(null);
    setBusyId(user.id);
    startTransition(async () => {
      const res = await setPlatformAdmin(user.id, !user.is_platform_admin);
      setBusyId(null);
      if (!res.ok && res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search by name, email, or organization…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {users.length} users
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Organizations</TableHead>
              <TableHead className="text-right">Jobs</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>Platform admin</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {query ? "No users match that search." : "No users yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => {
                const isSelf = user.id === currentUserId;
                const isBusy = busyId === user.id && pending;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{user.full_name || user.email || "Unnamed"}</span>
                        {user.full_name && user.email ? (
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.memberships.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {user.memberships.map((m) => (
                            <div key={m.org_id} className="flex items-center gap-2">
                              <span className="text-foreground">{m.org_name}</span>
                              <Badge variant="outline" className="text-[10px] font-normal capitalize">
                                {m.role}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {user.job_count}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeDate(user.last_sign_in_at)}
                    </TableCell>
                    <TableCell>
                      {user.is_platform_admin ? (
                        <Badge className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={user.is_platform_admin ? "outline" : "default"}
                        disabled={isSelf || isBusy}
                        onClick={() => toggleAdmin(user)}
                        title={
                          isSelf
                            ? "You can't change your own admin status."
                            : user.is_platform_admin
                              ? "Remove platform admin"
                              : "Make platform admin"
                        }
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : user.is_platform_admin ? (
                          <>
                            <ShieldOff className="h-3.5 w-3.5" />
                            <span className="ml-1">Remove admin</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span className="ml-1">Make admin</span>
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
