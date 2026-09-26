import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { mergeNoaEntries } from "@/lib/noa/merge";
import type { Tables } from "@/lib/supabase/types";
import { NewNoaDialog } from "./new-noa-dialog";
import { NoaLibrarySearch } from "./noa-library-search";
import { ShieldCheck } from "lucide-react";

type NoaOverride = Tables<"noa_library_overrides">;

export async function NoaLibraryBody() {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const isAdmin = await isPlatformAdmin();

  const [{ data: rawEntries }, { data: overrides }] = await Promise.all([
    supabase
      .from("noa_library")
      .select("*")
      .order("visibility", { ascending: false })
      .order("manufacturer")
      .order("series"),
    supabase.from("noa_library_overrides").select("*").eq("org_id", activeOrg.id),
  ]);

  const entries = mergeNoaEntries(
    rawEntries ?? [],
    (overrides ?? []) as NoaOverride[],
    activeOrg.id,
    isAdmin,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every Notice of Acceptance (or FL# product approval) lives here. The floor plan reads from this list —
          manufacturer, series, and model fill the schedule and drop into the permit ZIP.
        </p>
        <NewNoaDialog isAdmin={isAdmin} />
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No NOAs on file yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add your first Notice of Acceptance. Every job will check its window/door schedule against this library.
          </p>
        </div>
      ) : (
        <NoaLibrarySearch entries={entries} isAdmin={isAdmin} />
      )}
    </div>
  );
}
