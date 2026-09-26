import { HOMEOWNER_STAGES, HOA_STAGES, formatShortDate } from "@/lib/sales/friendly-status";
import { materialEtaIsSoon, ETA_SOON_PILL, formatEtaDate, reviewDateTone, DATE_TONE_PILL } from "@/lib/inventory/eta";

function DateCircle({
  value,
  closed,
}: {
  value: string | null | undefined;
  closed?: string | null;
}) {
  if (!value) return <span className="font-medium">—</span>;
  return <span className={DATE_TONE_PILL[reviewDateTone(value, closed)]}>{formatShortDate(value)}</span>;
}

export function DualBars({
  permitIndex,
  hoaIndex,
  hoaLabel,
}: {
  permitIndex: number;
  hoaIndex: number;
  hoaLabel: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Permit</p>
          <p className="text-sm font-medium text-foreground">
            {HOMEOWNER_STAGES[permitIndex]?.short ?? ""}
          </p>
        </div>
        <ol className="mt-2 grid grid-cols-6 gap-1.5">
          {HOMEOWNER_STAGES.map((s, i) => (
            <li key={s.key}>
              <div className={`h-3 rounded-full ${i <= permitIndex ? "bg-primary" : "bg-muted"}`} />
            </li>
          ))}
        </ol>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">HOA</p>
          <p className="text-sm font-medium text-foreground">{hoaLabel}</p>
        </div>
        <ol className="mt-2 grid grid-cols-5 gap-1.5">
          {HOA_STAGES.map((s, i) => (
            <li key={s.key}>
              <div className={`h-3 rounded-full ${i <= hoaIndex ? "bg-violet-500" : "bg-muted"}`} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export type TimelineFields = {
  permitTitle: string;
  permitEta: string;
  stageIndex: number;
  permitAssigned: string | null;
  permitSubmitted: string | null;
  permitApproved: string | null;
  permitNumber: string | null;
  permitTech: string;
  hoaTitle: string;
  hoaEta: string;
  hoaStageIndex: number;
  hoaAssigned: string | null;
  hoaSubmitted: string | null;
  hoaApproved: string | null;
  hoaTech: string;
  orderedDate: string | null;
  materialEta: string | null;
};

export function StatusTimeline({
  data,
  showTechs,
  alwaysShowPermitNumber = false,
}: {
  data: TimelineFields;
  showTechs: boolean;
  alwaysShowPermitNumber?: boolean;
}) {
  const hoaShort =
    data.hoaEta === "Not needed" ? "Not needed" : (HOA_STAGES[data.hoaStageIndex]?.short ?? data.hoaTitle);
  const showPermitNumber = alwaysShowPermitNumber || !!data.permitNumber;

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <DualBars permitIndex={data.stageIndex} hoaIndex={data.hoaStageIndex} hoaLabel={hoaShort} />

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Job ordered</dt>
          <dd><DateCircle value={data.orderedDate} closed={data.orderedDate} /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Material ETA</dt>
          <dd className="font-medium">
            {data.materialEta && materialEtaIsSoon(data.materialEta) ? (
              <span className={ETA_SOON_PILL}>{formatEtaDate(data.materialEta)}</span>
            ) : (
              formatShortDate(data.materialEta)
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Permit</p>
          <p className="mt-1 font-heading text-lg">{data.permitTitle || HOMEOWNER_STAGES[data.stageIndex]?.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{data.permitEta}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Assigned</dt>
              <dd><DateCircle value={data.permitAssigned} closed={data.permitSubmitted} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Submitted</dt>
              <dd><DateCircle value={data.permitSubmitted} closed={data.permitApproved} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Approved</dt>
              <dd><DateCircle value={data.permitApproved} closed={data.permitApproved} /></dd>
            </div>
            {showPermitNumber ? (
              <div>
                <dt className="text-xs text-muted-foreground">Permit number</dt>
                <dd className="font-medium">{data.permitNumber || "—"}</dd>
              </div>
            ) : null}
            {showTechs ? (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Permit tech</dt>
                <dd className="font-medium">{data.permitTech || "Unassigned"}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">HOA</p>
          <p className="mt-1 font-heading text-lg">{data.hoaTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{data.hoaEta}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Assigned</dt>
              <dd><DateCircle value={data.hoaAssigned} closed={data.hoaSubmitted} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Submitted</dt>
              <dd><DateCircle value={data.hoaSubmitted} closed={data.hoaApproved} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Approved</dt>
              <dd><DateCircle value={data.hoaApproved} closed={data.hoaApproved} /></dd>
            </div>
            {showTechs ? (
              <div>
                <dt className="text-xs text-muted-foreground">HOA tech</dt>
                <dd className="font-medium">{data.hoaTech || "Unassigned"}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </section>
  );
}
