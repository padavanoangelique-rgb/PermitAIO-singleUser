import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-config";

export function homeownerUrl(token: string) {
  return `${SITE_URL}/track/${token}`;
}

export async function ensureHomeownerLink(orgId: string, jobId: string) {
  const supabase = await createClient();
  const existing = (await supabase
    .from("homeowner_links" as never)
    .select("token")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .maybeSingle()) as { data: { token: string } | null };

  if (existing.data?.token) return existing.data.token;

  const token = randomBytes(24).toString("hex");
  const db = supabase as unknown as {
    from: (t: string) => {
      upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await db.from("homeowner_links").upsert(
    { org_id: orgId, job_id: jobId, token, enabled: true },
    { onConflict: "org_id,job_id" },
  );
  if (error) {
    const again = (await supabase
      .from("homeowner_links" as never)
      .select("token")
      .eq("org_id", orgId)
      .eq("job_id", jobId)
      .maybeSingle()) as { data: { token: string } | null };
    if (again.data?.token) return again.data.token;
    throw new Error(error.message);
  }
  return token;
}
