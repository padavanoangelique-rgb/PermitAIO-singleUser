import { createAdminClient } from "@/lib/supabase/admin";
import { LeadsManager, type LeadRow } from "./leads-manager";

/**
 * `/admin/leads` — inbox for the on-page pricing contact form.
 *
 * Layout is already gated by requirePlatformAdmin() in the admin layout,
 * and every write goes through server actions in
 * `src/lib/actions/platform-leads.ts` which re-check platform admin.
 */
export default async function AdminLeadsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_leads")
    .select(
      "id, created_at, name, email, phone, company, plan_of_interest, message, status, admin_notes, source",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as LeadRow[];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Leads
        </h1>
        <p className="text-sm text-muted-foreground">
          Every submission from the pricing page contact form. Newest first.
          Update the status as you work each one — the row stays visible so you
          keep a paper trail.
        </p>
      </div>
      <LeadsManager rows={rows} />
    </div>
  );
}
