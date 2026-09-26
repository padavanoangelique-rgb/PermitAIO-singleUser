"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Mail, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { updateLead, deleteLead } from "@/lib/actions/platform-leads";
import { cn } from "@/lib/utils";

export type LeadRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  plan_of_interest: string | null;
  message: string | null;
  status: "new" | "contacted" | "converted" | "dropped";
  admin_notes: string | null;
  source: string | null;
};

const STATUS_OPTIONS: LeadRow["status"][] = [
  "new",
  "contacted",
  "converted",
  "dropped",
];

const STATUS_STYLES: Record<LeadRow["status"], string> = {
  new: "bg-primary/15 text-primary border-primary/30",
  contacted: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  converted: "bg-emerald-500/15 text-emerald-700 border-emerald-600/30",
  dropped: "bg-muted text-muted-foreground border-border",
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function LeadsManager({ rows }: { rows: LeadRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | LeadRow["status"]
  >("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.email, r.company, r.phone, r.message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<LeadRow["status"] | "all", number> = {
      all: rows.length,
      new: 0,
      contacted: 0,
      converted: 0,
      dropped: 0,
    };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company, phone, message..."
          className="sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-1">
          {(["all", ...STATUS_OPTIONS] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}{" "}
              <span className="ml-1 opacity-70">({counts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No leads match those filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Name / Company</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <LeadRowView key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeadRowView({ row }: { row: LeadRow }) {
  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
        {dateFmt.format(new Date(row.created_at))}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground/90">{row.name}</div>
        {row.company && (
          <div className="text-xs text-muted-foreground">{row.company}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        <a
          className="flex items-center gap-1 text-primary hover:underline"
          href={`mailto:${row.email}`}
        >
          <Mail className="h-3 w-3" />
          {row.email}
        </a>
        {row.phone && (
          <a
            className="mt-1 flex items-center gap-1 text-muted-foreground hover:text-foreground"
            href={`tel:${row.phone}`}
          >
            <Phone className="h-3 w-3" />
            {row.phone}
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
        {row.plan_of_interest ?? "—"}
      </td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={cn(
            "capitalize border",
            STATUS_STYLES[row.status],
          )}
        >
          {row.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <EditLeadDialog row={row} />
          <DeleteLeadButton id={row.id} name={row.name} />
        </div>
      </td>
    </tr>
  );
}

function EditLeadDialog({ row }: { row: LeadRow }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<LeadRow["status"]>(row.status);
  const [notes, setNotes] = useState(row.admin_notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateLead({ id: row.id, status, admin_notes: notes });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          View / update
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {row.name}
            {row.company ? ` — ${row.company}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 text-xs">
            <div>
              <div className="font-medium text-foreground/80">Email</div>
              <div className="text-muted-foreground">{row.email}</div>
            </div>
            <div>
              <div className="font-medium text-foreground/80">Phone</div>
              <div className="text-muted-foreground">{row.phone ?? "—"}</div>
            </div>
            <div>
              <div className="font-medium text-foreground/80">
                Plan of interest
              </div>
              <div className="capitalize text-muted-foreground">
                {row.plan_of_interest ?? "—"}
              </div>
            </div>
            <div>
              <div className="font-medium text-foreground/80">Received</div>
              <div className="text-muted-foreground">
                {dateFmt.format(new Date(row.created_at))}
              </div>
            </div>
          </div>

          {row.message && (
            <div>
              <Label className="text-xs font-medium">Message</Label>
              <div className="mt-1 whitespace-pre-wrap rounded-lg border border-border/60 bg-card p-3 text-sm text-foreground/90">
                {row.message}
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor={`status-${row.id}`}>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as LeadRow["status"])}
            >
              <SelectTrigger id={`status-${row.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`notes-${row.id}`}>Internal notes</Label>
            <Textarea
              id={`notes-${row.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What did you send them? What did they say?"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteLead({ id });
      } catch (err) {
        console.error("deleteLead failed", err);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete lead from ${name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
          <AlertDialogDescription>
            {name}&apos;s submission will be permanently removed. You can&apos;t undo this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
