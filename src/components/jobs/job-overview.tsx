"use client";

import type { ReactNode } from "react";
import { FloorPlanShare } from "@/components/jobs/floor-plan-share";
import { StatusTimeline, type TimelineFields } from "@/components/sales/status-card";
import { formatShortDate } from "@/lib/sales/friendly-status";
import { materialEtaIsSoon, ETA_SOON_PILL, formatEtaDate } from "@/lib/inventory/eta";

export function JobOverview({
  jobId,
  notes,
  isRoofing,
  timeline,
  meta,
  shareCard,
}: {
  jobId: string;
  notes: string | null;
  isRoofing: boolean;
  timeline: TimelineFields;
  meta: {
    folio: string | null;
    city: string | null;
    jurisdiction: string | null;
    noc: string | null;
    orderedDate: string | null;
    materialEta: string | null;
  };
  shareCard?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <StatusTimeline data={timeline} showTechs alwaysShowPermitNumber />

      <dl className="grid grid-cols-2 gap-3 px-1 py-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Meta label="Folio" value={meta.folio} />
        <Meta label="City" value={meta.city} />
        <Meta label="Jurisdiction" value={meta.jurisdiction} />
        <Meta label="NOC" value={meta.noc} />
        <Meta label="Job ordered" value={meta.orderedDate ? formatShortDate(meta.orderedDate) : "—"} />
        <Meta
          label="Material ETA"
          value={
            meta.materialEta && materialEtaIsSoon(meta.materialEta) ? (
              <span className={ETA_SOON_PILL}>{formatEtaDate(meta.materialEta)}</span>
            ) : (
              meta.materialEta ? formatShortDate(meta.materialEta) : "—"
            )
          }
        />
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2 px-1 py-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Note for this job</h2>
          <p className="text-sm text-muted-foreground">
            Full thread is on Activity & notes. Homeowners do not see this.
          </p>
          <p className="text-sm">{notes || "No notes yet."}</p>
        </section>
        {!isRoofing ? <FloorPlanShare jobId={jobId} /> : null}
      </div>

      {shareCard ? <div>{shareCard}</div> : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}
