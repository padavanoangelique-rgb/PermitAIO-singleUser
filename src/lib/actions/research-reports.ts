"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";
import { insertProposal } from "./proposed-updates";

function table(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

export async function feedResearchReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const agentRaw = String(formData.get("agent") ?? "").trim();
  const agent = agentRaw === "forms_specialist" ? "forms_specialist" : "investigator";
  const county = String(formData.get("county") ?? "").trim() || null;
  const jurisdiction = String(formData.get("jurisdiction") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim() || `${agent === "investigator" ? "Investigator" : "Forms"} report`;
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Paste the report." };

  const proposed = await insertProposal({
    orgId: activeOrg.id,
    userId: user.id,
    authorLabel: user.email || "teammate",
    library: "research_reports",
    kind: "research_report",
    why: "Research report submitted for review. It is not in the desks until someone adds it.",
    proposed: { agent, county, jurisdiction, title, body },
  });
  if (!proposed.error) {
    revalidatePath("/libraries");
    return {
      error: null,
      message: "Submitted for review. It is not in the desks until someone adds it to the database.",
    };
  }

  const { error } = await table(supabase, "research_reports").insert({
    org_id: activeOrg.id,
    agent,
    county,
    jurisdiction,
    title,
    body,
    created_by: user.id,
  });
  if (error) return { error: "Could not save the report yet. Paste it in this Grok chat and I’ll load it as his starting brain." };

  revalidatePath("/libraries");
  revalidatePath("/admin/xena");
  revalidatePath("/settings");
  return { error: null, message: "Saved. Manager will use this on the next question." };
}
