import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site-config";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

/**
 * One QR token per job, created the first time anyone prints a sticker
 * for it (not backfilled for every job) — the same token is reused for
 * every later print and every scan purpose (permit custody, warehouse
 * job lookup), so the physical sticker never goes stale.
 */
export async function ensureJobScanToken(jobId: string, orgId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: existing } = await adminTable(admin, "job_scan_tokens")
    .select("token")
    .eq("job_id", jobId)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  const { data: created, error } = await adminTable(admin, "job_scan_tokens")
    .insert({ job_id: jobId, org_id: orgId })
    .select("token")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not create a scan token.");
  return created.token as string;
}

export function scanUrlForToken(token: string): string {
  return `${SITE_URL}/scan/${token}`;
}
