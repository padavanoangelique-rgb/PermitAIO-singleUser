import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { mergeNoaEntries } from "@/lib/noa/merge";
import { NewNoaDialog } from "@/app/(app)/noa-library/new-noa-dialog";
import { NoaLibrarySearch } from "@/app/(app)/noa-library/noa-library-search";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

/**
 * Platform-only view of the NOA Library. The admin layout already gates
 * this route with requirePlatformAdmin(), so we don't re-check here.
 *
 * Shows just visibility='platform' rows (the shared library every org
 * sees) and reuses the same NewNoaDialog + NoaLibrarySearch as
 * /noa-library — with isAdmin hard-wired true so the "Publish to
 * platform library" checkbox is on by default and platform rows are
 * editable.
 */
export default async function AdminNoaPage() {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const { data: rawEntries } = await supabase
    .from("noa_library")
    .select("*")
    .eq("visibility", "platform")
    .order("manufacturer")
    .order("series");

  // Overrides are per-org privacy overlays on top of platform rows.
  // We're on the admin page — surfacing Angelique's own org's
  // overrides would just confuse the "this is the shared library"
  // framing, so pass an empty list. mergeNoaEntries then leaves
  // effective_pressure_* equal to the base platform values.
  const entries = mergeNoaEntries(rawEntries ?? [], [], activeOrg.id, true);

  return (
    <div className="flex w-full max-w-none flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Platform NOA Library
          </h1>
          <p className="text-sm text-muted-foreground">
            The shared Notice of Acceptance catalog every organization
            sees. Add, edit, or remove rows here — private per-org NOAs
            aren&rsquo;t shown on this page.
          </p>
        </div>
        <NewNoaDialog isAdmin />
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No platform NOAs yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add the first Notice of Acceptance. It will appear in
              every organization&rsquo;s library automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <NoaLibrarySearch entries={entries} isAdmin />
      )}
    </div>
  );
}
