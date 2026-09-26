import { createClient } from "@/lib/supabase/server";

export async function recordAssignedRole(orgId: string, email: string, role: string, techSlot?: string | null) {
  const supabase = await createClient();
  const table = supabase as unknown as {
    from: (t: string) => {
      upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await table.from("assigned_roles").upsert(
    {
      org_id: orgId,
      email: email.trim().toLowerCase(),
      role,
      tech_slot: techSlot || null,
    },
    { onConflict: "org_id,email" },
  );
  if (error && !error.message.toLowerCase().includes("does not exist")) {
    return error.message;
  }
  return null;
}
