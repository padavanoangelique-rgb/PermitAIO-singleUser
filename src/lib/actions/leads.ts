"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const submitLeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  company: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  plan_of_interest: z
    .enum(["essential", "priority", "concierge", "unsure"])
    .optional()
    .transform((v) => v ?? "unsure"),
  message: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  website: z.string().max(200).optional(),
});

export type SubmitLeadInput = z.input<typeof submitLeadSchema>;
export type SubmitLeadResult =
  | { ok: true }
  | { ok: false; error: string };

const LEAD_ENDPOINT = "https://api.resend.com/emails";
const FROM_ADDRESS = "PermitAIO <hello@permitaio.com>";
const NOTIFY_TO = ["hello@permitaio.com", "padavano.angelique@gmail.com"];

export async function submitLead(
  input: SubmitLeadInput,
): Promise<SubmitLeadResult> {
  const parsed = submitLeadSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Please check your details.";
    return { ok: false, error: first };
  }

  const data = parsed.data;
  if (data.website && data.website.length > 0) {
    return { ok: true };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("platform_leads").insert({
    name: data.name,
    email: data.email,
    phone: data.phone,
    company: data.company,
    plan_of_interest: data.plan_of_interest,
    message: data.message,
    source: "pricing_page",
  });

  if (error) {
    console.error("submitLead: insert failed", error);
    return {
      ok: false,
      error: "Something went wrong on our end. Please email Hello@Permitaio.com.",
    };
  }

  void notifyLead(data).catch((err) => {
    console.error("submitLead: notify failed", err);
  });

  return { ok: true };
}

async function notifyLead(data: {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  plan_of_interest: string;
  message: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("submitLead: RESEND_API_KEY not set, skipping email.");
    return;
  }

  const subject = `New PermitAIO lead: ${data.name}${data.company ? ` — ${data.company}` : ""}`;

  const html = `
    <p>New lead from the PermitAIO pricing page.</p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(data.name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(data.email)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(data.phone ?? "—")}</li>
      <li><strong>Company:</strong> ${escapeHtml(data.company ?? "—")}</li>
      <li><strong>Plan of interest:</strong> ${escapeHtml(data.plan_of_interest)}</li>
      <li><strong>When:</strong> ${new Date().toISOString()}</li>
    </ul>
    ${
      data.message
        ? `<p><strong>Message:</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(data.message)}</pre>`
        : ""
    }
    <p style="color:#6b7280;font-size:12px">Reply directly to reach ${escapeHtml(data.email)}.</p>
  `;

  const res = await fetch(LEAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: NOTIFY_TO,
      reply_to: data.email,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`submitLead: Resend returned ${res.status}: ${body}`);
  }
}

function escapeHtml(value: string): string {
  const amp = String.fromCharCode(38);
  return value
    .split(amp).join(amp + "amp;")
    .split("<").join(amp + "lt;")
    .split(">").join(amp + "gt;")
    .split('"').join(amp + "quot;")
    .split("'").join(amp + "#39;");
}
