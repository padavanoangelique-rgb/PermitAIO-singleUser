"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { AdminOrgRow } from "@/lib/data/platform-admin";
import {
  createPaymentLink,
  deletePaymentLink,
  sendPaymentLink,
  updatePaymentLink,
} from "@/lib/actions/payment-links";
import {
  listOrgPaymentLinks,
  type PaymentLinkRow,
} from "@/lib/actions/list-payment-links";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Mail, Trash2, ExternalLink, Loader2 } from "lucide-react";

type PaymentLinkStatus = "open" | "paid" | "void";

const STATUS_LABEL: Record<PaymentLinkStatus, string> = {
  open: "Open",
  paid: "Paid",
  void: "Void",
};
const STATUS_VARIANT: Record<
  PaymentLinkStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open: "outline",
  paid: "default",
  void: "destructive",
};

function toStatus(value: string): PaymentLinkStatus {
  return value === "paid" || value === "void" ? value : "open";
}

export function PaymentLinksDialog({
  org,
  onClose,
}: {
  org: AdminOrgRow | null;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<PaymentLinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (orgId: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listOrgPaymentLinks({ org_id: orgId });
      setLinks(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (org) void refresh(org.id);
    else setLinks([]);
  }, [org, refresh]);

  return (
    <Dialog
      open={org !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Payment links — {org?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {org ? (
            <AddLinkForm
              orgId={org.id}
              onCreated={() => void refresh(org.id)}
            />
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Saved links</p>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            {!loading && links.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payment links stored for this org yet. Create one in Stripe,
                then paste it above.
              </p>
            ) : null}

            <div className="space-y-3">
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  ownerEmail={org?.owner_email ?? null}
                  ownerName={org?.name ?? null}
                  onChange={() => org && void refresh(org.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLinkForm({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(""); // dollars, decimal
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const trimmedUrl = url.trim();
    const trimmedLabel = label.trim();
    if (!trimmedUrl || !trimmedLabel) {
      setError("URL and label are required.");
      return;
    }

    let amountCents: number | null = null;
    if (amount.trim()) {
      const cleaned = amount.replace(/[$,\s]/g, "");
      const dollars = Number.parseFloat(cleaned);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setError("Amount must be a positive number.");
        return;
      }
      amountCents = Math.round(dollars * 100);
    }

    startTransition(async () => {
      try {
        await createPaymentLink({
          org_id: orgId,
          url: trimmedUrl,
          label: trimmedLabel,
          amount_cents: amountCents,
          currency: "usd",
          notes: notes.trim() || undefined,
        });
        setUrl("");
        setLabel("");
        setAmount("");
        setNotes("");
        onCreated();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Add a new payment link</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pl-url">Stripe URL</Label>
          <Input
            id="pl-url"
            type="url"
            placeholder="https://buy.stripe.com/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pl-label">Label</Label>
          <Input
            id="pl-label"
            placeholder="Essential onboarding + Sep 2026"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pl-amount">Amount (USD, optional)</Label>
          <Input
            id="pl-amount"
            inputMode="decimal"
            placeholder="1879.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pl-notes">Internal notes (optional)</Label>
          <Textarea
            id="pl-notes"
            rows={2}
            placeholder="What this covers, contract terms, expiration…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save link"}
        </Button>
      </div>
    </div>
  );
}

function LinkRow({
  link,
  ownerEmail,
  ownerName,
  onChange,
}: {
  link: PaymentLinkRow;
  ownerEmail: string | null;
  ownerName: string | null;
  onChange: () => void;
}) {
  const [sendOpen, setSendOpen] = useState(false);
  const [status, setStatus] = useState<PaymentLinkStatus>(toStatus(link.status));
  const [statusPending, startStatusTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  const amountLabel =
    link.amount_cents != null
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: (link.currency || "USD").toUpperCase(),
        }).format(link.amount_cents / 100)
      : null;

  function updateStatus(nextStatus: PaymentLinkStatus) {
    setStatus(nextStatus);
    startStatusTransition(async () => {
      try {
        await updatePaymentLink({ id: link.id, status: nextStatus });
        onChange();
      } catch {
        // revert on failure
        setStatus(toStatus(link.status));
      }
    });
  }

  function copyUrl() {
    void navigator.clipboard.writeText(link.url);
  }

  function remove() {
    if (
      !confirm(
        `Delete "${link.label}"? The Stripe payment link itself is not touched — void it in Stripe if needed.`,
      )
    )
      return;
    startDeleteTransition(async () => {
      try {
        await deletePaymentLink({ id: link.id });
        onChange();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{link.label}</p>
            <Badge variant={STATUS_VARIANT[status]}>
              {STATUS_LABEL[status]}
            </Badge>
            {amountLabel ? (
              <span className="text-sm text-muted-foreground">
                {amountLabel}
              </span>
            ) : null}
          </div>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{link.url}</span>
          </a>
          <p className="text-xs text-muted-foreground">
            Saved {formatDate(link.created_at)}
            {link.last_sent_at ? (
              <>
                {" · "}Last sent {formatDate(link.last_sent_at)}
                {link.last_sent_to ? ` to ${link.last_sent_to}` : ""}
                {link.sent_count ? ` (${link.sent_count}×)` : ""}
              </>
            ) : (
              <> · Never sent</>
            )}
          </p>
          {link.notes ? (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
              {link.notes}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(v: string) => updateStatus(toStatus(v))}
            disabled={statusPending}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={copyUrl}
            title="Copy URL"
          >
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setSendOpen(true)}
          >
            <Mail className="mr-1 h-3.5 w-3.5" />
            {link.last_sent_at ? "Resend" : "Send"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={deletePending}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <SendDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        link={link}
        defaultEmail={ownerEmail}
        defaultName={ownerName}
        onSent={onChange}
      />
    </div>
  );
}

function SendDialog({
  open,
  onClose,
  link,
  defaultEmail,
  defaultName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  link: PaymentLinkRow;
  defaultEmail: string | null;
  defaultName: string | null;
  onSent: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? "");
      setName(defaultName ?? "");
      setMessage("");
      setError(null);
      setSuccess(null);
    }
  }, [open, defaultEmail, defaultName]);

  function submit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await sendPaymentLink({
        id: link.id,
        recipient_email: email.trim(),
        recipient_name: name.trim() || null,
        message: message.trim() || undefined,
      });
      if (res.ok) {
        setSuccess(`Sent to ${email.trim()}.`);
        onSent();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send payment link</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{link.label}</p>
          <div className="space-y-1.5">
            <Label htmlFor="pl-send-email">Recipient email</Label>
            <Input
              id="pl-send-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-send-name">Recipient name (optional)</Label>
            <Input
              id="pl-send-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-send-message">Personal message (optional)</Label>
            <Textarea
              id="pl-send-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Any context you want the recipient to see above the payment button."
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? (
            <p className="text-sm text-emerald-600">{success}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={submit} disabled={pending || !email.trim()}>
            {pending
              ? "Sending…"
              : link.last_sent_at
                ? "Resend"
                : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
