"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";
import { FORM_COUNTIES } from "@/lib/forms/folio";
import { resolveJurisdiction } from "@/lib/forms/jurisdictions";
import { PanelSkeleton } from "@/components/ui/loading-skeletons";
import {
  RequirementsFormsView,
  type RequirementsFormsRow,
} from "@/app/(app)/requirements-forms/requirements-forms-view";
import { Card, CardContent } from "@/components/ui/card";
import { Info, TriangleAlert } from "lucide-react";

type Job = Tables<"jobs">;

/**
 * Job-page Requirements & Forms panel.
 *
 * Reads the platform-shared `requirements_forms` table and shows the
 * subset applicable to THIS job's jurisdiction ONLY — no picker. The
 * jurisdiction is resolved from `job.jurisdiction` via the canonical
 * jurisdiction catalog. If we can't resolve it, we show a "set the
 * jurisdiction on this job first" prompt.
 */
export function JobRequirementsFormsPanel({ job }: { job: Job }) {
  const [rows, setRows] = useState<RequirementsFormsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data: rowsData } = await supabase
        .from("requirements_forms")
        .select(
          "id, jurisdiction, title, notes, file_name, file_data, county, doc_type, trade",
        )
        .eq("visibility", "platform")
        .order("county")
        .order("jurisdiction");

      if (cancelled) return;
      setRows((rowsData ?? []) as RequirementsFormsRow[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [job.id, job.jurisdiction]);

  if (loading) return <PanelSkeleton />;

  const resolved = resolveJurisdiction(job.jurisdiction);

  if (!resolved) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium">
                Set this job&apos;s jurisdiction to see requirements & forms.
              </p>
              <p className="mt-1 text-muted-foreground">
                {job.jurisdiction
                  ? `We couldn't match "${job.jurisdiction}" to a tri-county jurisdiction.`
                  : "This job doesn't have a jurisdiction set yet."}{" "}
                Update it from the Forms Generator or Overview and this
                checklist will pre-fill automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-start gap-2 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Showing the window/door permit requirements for{" "}
            <span className="font-medium text-foreground">
              {resolved.city}, {resolved.county} County
            </span>
            . County-wide forms this city inherits are tagged{" "}
            <span className="font-medium text-foreground">County-wide</span>.
          </p>
        </CardContent>
      </Card>

      <RequirementsFormsView
        counties={FORM_COUNTIES}
        rows={rows}
        initialCounty={resolved.county}
        initialJurisdiction={resolved.city}
        compact
        lockJurisdiction
      />
    </div>
  );
}
