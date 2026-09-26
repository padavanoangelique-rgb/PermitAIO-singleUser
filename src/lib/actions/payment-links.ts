"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { requireUser } from "@/lib/data/orgs";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type PaymentLinkUpdate =
  Database["public"]["Tables"]["org_payment_links"]["Update"];

/**
 * Payment link management for platform admins.
 *
 * These are Stripe Payment Links Angelique creates manually in stripe.com
 * and stores against a specific org. Nothing here talks to the Stripe API.
 * "Send" just emails the URL to the customer via Resend and bumps
 * last_sent_at / sent_count.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_ADDRESS = "PermitAIO <notifications@permitaio.com>";
const REPLY_TO = "Hello@Permitaio.com";

const createSchema = z.object({
  org_id: z.string().uuid(),
  url: z.string().url("Paste the full https:// URL from Stripe"),
  label: z.string().trim().min(1, "Add a short label so you can tell them apart").max(160),
  amount_cents: z
    .number()
    .int()
    .positive()
    .max(100_000_000)
    .optional()
    .nullable(),
  currency: z.string().trim().toLowerCase().min(3).max(3).default("usd"),
  notes: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function createPaymentLink(input: z.input<typeof createSchema>) {
  await requirePlatformAdmin();
  const user = await requireUser();
  const parsed = createSchema.parse(input);

  const admin = createAdminClient();
  const { error } = await admin.from("org_payment_links").insert({
    org_id: parsed.org_id,
    url: parsed.url,
    label: parsed.label,
    amount_cents: parsed.amount_cents ?? null,
    currency: parsed.currency,
    notes: parsed.notes,
    created_by: user.id,
  });

  if (error) throw new Error(`Failed to save payment link: ${error.message}`);

  revalidatePath("/admin/trials");
  return { ok: true as const };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(160).optional(),
  status: z.enum(["open", "paid", "void"]).optional(),
  notes: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updatePaymentLink(input: z.input<typeof updateSchema>) {
  await requirePlatformAdmin();
  const parsed = updateSchema.parse(input);

  const admin = createAdminClient();
  const patch: PaymentLinkUpdate = {};
  if (parsed.label !== undefined) patch.label = parsed.label;
  if (parsed.status !== undefined) {
    patch.status = parsed.status;
    patch.paid_at = parsed.status === "paid" ? new Date().toISOString() : null;
  }
  if (parsed.notes !== undefined) patch.notes = parsed.notes;

  const { error } = await admin
    .from("org_payment_links")
    .update(patch)
    .eq("id", parsed.id);

  if (error) throw new Error(`Failed to update payment link: ${error.message}`);

  revalidatePath("/admin/trials");
  return { ok: true as const };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deletePaymentLink(input: z.input<typeof deleteSchema>) {
  await requirePlatformAdmin();
  const parsed = deleteSchema.parse(input);

  const admin = createAdminClient();
  const { error } = await admin
    .from("org_payment_links")
    .delete()
    .eq("id", parsed.id);

  if (error) throw new Error(`Failed to delete payment link: ${error.message}`);

  revalidatePath("/admin/trials");
  return { ok: true as const };
}

const sendSchema = z.object({
  id: z.string().uuid(),
  recipient_email: z.string().trim().toLowerCase().email("Enter a valid email"),
  recipient_name: z.string().trim().max(160).optional().nullable(),
  message: z
    .string()
    .max(4000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type SendPaymentLinkInput = z.input<typeof sendSchema>;
export type SendPaymentLinkResult =
  | { ok: true; sent_count: number; last_sent_at: string }
  | { ok: false; error: string };

export async function sendPaymentLink(
  input: SendPaymentLinkInput,
): Promise<SendPaymentLinkResult> {
  await requirePlatformAdmin();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // Load the link + its org so the email has enough context.
  const { data: link, error: linkErr } = await admin
    .from("org_payment_links")
    .select(
      "id, url, label, amount_cents, currency, sent_count, org_id, organizations:org_id(name)",
    )
    .eq("id", data.id)
    .single();

  if (linkErr || !link) {
    return { ok: false, error: "Payment link not found." };
  }

  const orgName =
    (link.organizations as { name: string } | null)?.name ?? "your team";

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Email not configured (RESEND_API_KEY missing). Copy the URL and send it manually.",
    };
  }

  const amountLabel =
    link.amount_cents != null
      ? formatAmount(link.amount_cents, link.currency)
      : null;

  const subject = `Your PermitAIO payment link${
    amountLabel ? ` — ${amountLabel}` : ""
  }`;

  const greetingName = data.recipient_name?.trim() || "there";
  const customMessage = data.message
    ? `<p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>`
    : "";

  const html = `
    <p>Hi ${escapeHtml(greetingName)},</p>
    <p>Here is the secure Stripe payment link for <strong>${escapeHtml(
      orgName,
    )}</strong> — <strong>${escapeHtml(link.label)}</strong>${
      amountLabel ? ` (${escapeHtml(amountLabel)})` : ""
    }.</p>
    <p style="margin:24px 0">
      <a href="${escapeAttr(link.url)}"
         style="background:#01696F;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
        Pay securely on Stripe
      </a>
    </p>
    <p style="font-size:12px;color:#6b7280">Or copy this link into your browser:<br>
      <a href="${escapeAttr(link.url)}">${escapeHtml(link.url)}</a>
    </p>
    ${customMessage}
    <p>Reply to this email if you have any questions — it comes straight to me.</p>
    <p>— Angelique<br>PermitAIO</p>
  `;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [data.recipient_email],
      reply_to: REPLY_TO,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`sendPaymentLink: Resend ${res.status}: ${body}`);
    return {
      ok: false,
      error: `Email service returned ${res.status}. Copy the URL and send it manually.`,
    };
  }

  const now = new Date().toISOString();
  const nextCount = (link.sent_count ?? 0) + 1;
  const { error: updateErr } = await admin
    .from("org_payment_links")
    .update({
      last_sent_at: now,
      last_sent_to: data.recipient_email,
      sent_count: nextCount,
    })
    .eq("id", data.id);

  if (updateErr) {
    console.error("sendPaymentLink: post-send update failed", updateErr);
    // Not fatal — the email was sent. Just tell the caller.
  }

  revalidatePath("/admin/trials");
  return { ok: true, sent_count: nextCount, last_sent_at: now };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
