"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "./auth";

export async function createJob(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const client_name = String(formData.get("client_name") ?? "").trim();
  const job_number = String(formData.get("job_number") ?? "").trim();
  const trade_type = String(formData.get("trade_type") ?? "windows");
  const address = String(formData.get("address") ?? "").trim() || null;
  const folio_number = String(formData.get("folio_number") ?? "").trim() || null;

  if (!client_name || !job_number) {
    return { error: "Client name and job number are required." };
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      org_id: activeOrg.id,
      client_name,
      job_number,
      trade_type,
      address,
      folio_number,
      created_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !job) {
    return {
      error: error?.code === "23505"
        ? "A job with that number already exists."
        : error?.message ?? "Couldn't create the job.",
    };
  }

  revalidatePath("/dashboard");
  redirect(`/jobs/${job.id}`);
}
