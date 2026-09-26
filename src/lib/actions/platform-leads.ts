"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const statusSchema = z.enum(["new", "contacted", "converted", "dropped"]);

const updateSchema = z.object({
  id: z.string().uuid(),
  status: statusSchema,
  admin_notes: z
    .string()
    .max(4000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateLead(input: z.input<typeof updateSchema>) {
  await requirePlatformAdmin();
  const parsed = updateSchema.parse(input);

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_leads")
    .update({
      status: parsed.status,
      admin_notes: parsed.admin_notes,
    })
    .eq("id", parsed.id);

  if (error) throw new Error(`Failed to update lead: ${error.message}`);

  revalidatePath("/admin/leads");
  return { ok: true as const };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteLead(input: z.input<typeof deleteSchema>) {
  await requirePlatformAdmin();
  const parsed = deleteSchema.parse(input);

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_leads")
    .delete()
    .eq("id", parsed.id);

  if (error) throw new Error(`Failed to delete lead: ${error.message}`);

  revalidatePath("/admin/leads");
  return { ok: true as const };
}
