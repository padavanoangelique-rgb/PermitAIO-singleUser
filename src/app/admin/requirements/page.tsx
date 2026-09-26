import { createAdminClient } from "@/lib/supabase/admin";
import { FORM_COUNTIES } from "@/lib/forms/folio";
import { RequirementsManager, type RequirementRow } from "./requirements-manager";

/**
 * `/admin/requirements` — editing view of the platform-shared
 * Requirements & Forms library (the `requirements_forms` table, not the
 * separate `form_templates` platform Forms library).
 *
 * Layout is already gated by requirePlatformAdmin() in the admin
 * layout; every write goes through server actions in
 * `src/lib/actions/platform-requirements.ts` which re-check.
 */
export default async function AdminRequirementsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("requirements_forms")
    .select("id, county, jurisdiction, jurisdiction_code, doc_type, title, notes, trade, visibility")
    .eq("visibility", "platform")
    .order("county")
    .order("jurisdiction")
    .order("id");

  const rows = (data ?? []) as RequirementRow[];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Requirements &amp; Forms
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide reference library. Every organization sees these rows on
          their <code className="text-xs">/requirements-forms</code> page. Add
          the notes, the source URL, and the doc type — no file upload here,
          everything lives in the notes field.
        </p>
      </div>
      <RequirementsManager counties={FORM_COUNTIES} rows={rows} />
    </div>
  );
}
