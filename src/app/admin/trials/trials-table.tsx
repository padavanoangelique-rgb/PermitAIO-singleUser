"use client";

import { useEffect, useState, useTransition } from "react";
import type { AdminOrgRow } from "@/lib/data/platform-admin";
import { extendOrgTrial, compOrg, uncompOrg, cancelOrgSubscription, setOrgSubscriptionTier } from "@/lib/actions/platform-trials";
import { platformAdminInviteToOrg } from "@/lib/actions/platform-invites";
import { INVITABLE_ROLES, type InvitableRole } from "@/lib/data/invite-roles";
import { subscriptionTiers, soloOwnerTier } from "@/lib/marketing/pricing";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal } from "lucide-react";
import { PaymentLinksDialog } from "./payment-links-dialog";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete_expired: "Expired",
  comped: "Comped (free)",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  trialing: "outline",
  active: "default",
  past_due: "secondary",
  canceled: "destructive",
  unpaid: "destructive",
  incomplete_expired: "destructive",
  comped: "secondary",
};

// Account types an admin can pick from this dropdown — one place to add
// the next account type when it comes: give it its own SubscriptionTier
// export in pricing.ts and list it here.
const ACCOUNT_TYPES: { id: string; name: string }[] = [
  ...subscriptionTiers.map((t) => ({ id: t.id, name: t.name })),
  { id: soloOwnerTier.id, name: soloOwnerTier.name },
];

function trialLabel(row: AdminOrgRow): string {
  const status = row.subscription_status ?? "trialing";
  if (status !== "trialing" || !row.trial_ends_at) return "—";
  const daysLeft = Math.ceil((new Date(row.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "Expired";
  if (daysLeft === 0) return "Ends today";
  return `${daysLeft}d left`;
}

export function TrialsTable({
  orgs,
  highlightSlug,
}: {
  orgs: AdminOrgRow[];
  highlightSlug?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<AdminOrgRow | null>(null);
  const [paymentLinksTarget, setPaymentLinksTarget] = useState<AdminOrgRow | null>(null);

  // TableRow doesn't forward a ref (it's a plain function component that
  // spreads ...props but never destructures `ref`), so scroll via the DOM
  // id every row already carries instead of a ref that would silently
  // never attach.
  useEffect(() => {
    if (!highlightSlug) return;
    const el = document.getElementById(`org-${highlightSlug}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightSlug]);

  function run(orgId: string, action: () => Promise<{ error: string | null }>) {
    setBusyOrgId(orgId);
    setError(null);
    startTransition(async () => {
      const res = await action();
      setBusyOrgId(null);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Org</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trial ends</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => {
              const status = org.subscription_status ?? "trialing";
              const busy = busyOrgId === org.id && pending;
              const isHighlighted = highlightSlug === org.slug;
              return (
                <TableRow
                  key={org.id}
                  id={`org-${org.slug}`}
                  className={isHighlighted ? "bg-primary/5" : undefined}
                >
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{org.owner_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{STATUS_LABEL[status] ?? status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{trialLabel(org)}</TableCell>
                  <TableCell>
                    <Select
                      value={org.subscription_tier ?? undefined}
                      onValueChange={(value) => run(org.id, () => setOrgSubscriptionTier(org.id, value))}
                      disabled={busy}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-sm capitalize">
                        <SelectValue placeholder={org.plan} />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" disabled={busy}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Trial</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => run(org.id, () => extendOrgTrial(org.id, 14))}>
                          Extend 14 days
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(org.id, () => extendOrgTrial(org.id, 30))}>
                          Extend 30 days
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(org.id, () => extendOrgTrial(org.id, 60))}>
                          Extend 60 days
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Billing</DropdownMenuLabel>
                        {status === "comped" ? (
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm(`Un-comp ${org.name}? This reverts to a fresh 14-day trial.`)) {
                                run(org.id, () => uncompOrg(org.id));
                              }
                            }}
                          >
                            Un-comp org
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm(`Comp ${org.name} (free forever)? This disables Stripe billing for this org.`)) {
                                run(org.id, () => compOrg(org.id));
                              }
                            }}
                          >
                            Comp org (free forever)
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                `Cancel ${org.name}'s subscription? Their Stripe subscription itself isn't touched — cancel it there too if one exists.`,
                              )
                            ) {
                              run(org.id, () => cancelOrgSubscription(org.id));
                            }
                          }}
                        >
                          Cancel subscription
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setInviteTarget(org)}>
                          Invite user to this org…
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPaymentLinksTarget(org)}>
                          Payment links…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <InviteDialog org={inviteTarget} onClose={() => setInviteTarget(null)} />
      <PaymentLinksDialog
        org={paymentLinksTarget}
        onClose={() => setPaymentLinksTarget(null)}
      />
    </div>
  );
}

function InviteDialog({ org, onClose }: { org: AdminOrgRow | null; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("member");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    if (!org) return;
    setSending(true);
    setError(null);
    setMessage(null);
    const res = await platformAdminInviteToOrg(org.id, email, role);
    setSending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setMessage(res.message ?? "Invite sent.");
    setEmail("");
  }

  return (
    <Dialog
      open={org !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setError(null);
          setMessage(null);
          setEmail("");
          setRole("member");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user to {org?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as InvitableRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={send} disabled={sending || !email.trim()}>
            {sending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
