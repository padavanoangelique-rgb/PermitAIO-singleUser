import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { CorrectionsBoard, type CorrectionRow, type VersionRow } from "@/components/libraries/corrections-board";

function from(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

export async function CorrectionsLibraryBody() {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const [rowsRes, versionsRes] = await Promise.all([
    from(supabase, "corrections_library")
      .select(
        "id, jurisdiction, correction, resolution, job_number, cross_ref, original_submission, approval_ground_truth, scope, status, version, author_label, updated_at",
      )
      .eq("org_id", activeOrg.id)
      .in("status", ["published", "held"])
      .order("updated_at", { ascending: false })
      .limit(100),
    from(supabase, "library_entry_versions")
      .select("entry_id, version, change_note, author_label, created_at, snapshot")
      .eq("org_id", activeOrg.id)
      .eq("library", "corrections")
      .order("version", { ascending: false })
      .limit(200),
  ]);

  return (
    <CorrectionsBoard
      rows={(rowsRes.error ? [] : (rowsRes.data as CorrectionRow[] | null)) ?? []}
      versions={(versionsRes.error ? [] : (versionsRes.data as VersionRow[] | null)) ?? []}
    />
  );
}
