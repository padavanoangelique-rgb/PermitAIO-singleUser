import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import type { Tables } from "@/lib/supabase/types";
import { FormsCountyBoard } from "@/components/libraries/forms-county-board";
import type { RequirementsRow } from "@/lib/forms/borrow-rules";

type FormTemplate = Tables<"form_templates">;

export async function FormsLibraryBody() {
  await requireActiveOrg();
  const supabase = await createClient();
  const admin = await isPlatformAdmin();

  const [{ data }, { data: requirementRows }] = await Promise.all([
    supabase
      .from("form_templates")
      .select("*")
      .eq("visibility", "platform")
      .order("county")
      .order("sort_order"),
    supabase
      .from("requirements_forms")
      .select("id, jurisdiction, title, notes, file_name, file_data, county, doc_type, trade")
      .eq("visibility", "platform")
      .order("county")
      .order("jurisdiction"),
  ]);

  return (
    <FormsCountyBoard
      rows={(requirementRows ?? []) as RequirementsRow[]}
      templates={(data ?? []) as FormTemplate[]}
      isAdmin={admin}
    />
  );
}
