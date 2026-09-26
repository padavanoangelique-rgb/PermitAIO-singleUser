"use server";

import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type PaymentLinkRow =
  Database["public"]["Tables"]["org_payment_links"]["Row"];

const schema = z.object({ org_id: z.string().uuid() });

export async function listOrgPaymentLinks(
  input: z.input<typeof schema>,
): Promise<PaymentLinkRow[]> {
  await requirePlatformAdmin();
  const parsed = schema.parse(input);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("org_payment_links")
    .select("*")
    .eq("org_id", parsed.org_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load payment links: ${error.message}`);
  return data ?? [];
}
