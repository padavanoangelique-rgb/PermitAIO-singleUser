"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";

export async function addInstallNote(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = String(formData.get("jobId") ?? "");
  const kind = String(formData.get("kind") ?? "office");
  const message = String(formData.get("message") ?? "").trim();
  if (!jobId || !message) {
    redirect("/install?mail=" + encodeURIComponent("Type a note first."));
  }
  const supabase = await createClient();
  const { error } = await supabase.from("job_activity").insert({
    org_id: activeOrg.id,
    job_id: jobId,
    user_id: user.id,
    activity_type: kind === "installer" ? "installer_note" : "office_note",
    message,
  });
  if (error) {
    redirect("/install?mail=" + encodeURIComponent(error.message));
  }
  revalidatePath("/install");
  redirect("/install?mail=" + encodeURIComponent("Note saved."));
}
