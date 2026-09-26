"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTechLabel } from "@/components/tech-slots-provider";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

const CHIP =
  "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold";

export type TechBreakdownRow = {
  tech: string;
  total: number;
  needToSubmit: number;
  inReview: number;
  approved: number;
};

export type AmBreakdownRow = {
  id: string;
  name: string;
  total: number;
  scheduled: number;
  inProgress: number;
  pendingFinal: number;
};

export type TechFilter =
  | { kind: "permit" | "hoa"; tech: string }
  | { kind: "am"; id: string; name: string }
  | null;

export function TeamStatusPanel({
  permitTechs,
  hoaTechs,
  accountManagers,
  selected,
  onSelect,
}: {
  permitTechs: TechBreakdownRow[];
  hoaTechs: TechBreakdownRow[];
  accountManagers?: AmBreakdownRow[];
  selected?: TechFilter;
  onSelect?: (next: TechFilter) => void;
}) {
  return (
    <section className="print:hidden">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Team status</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Tap a permit tech, HOA tech, or account manager to see every job they hold.
      </p>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <TechGroup
          title="Permit techs"
          kind="permit"
          rows={permitTechs}
          selected={selected}
          onSelect={onSelect}
        />
        <TechGroup
          title="HOA techs"
          kind="hoa"
          rows={hoaTechs}
          selected={selected}
          onSelect={onSelect}
        />
        {accountManagers ? (
          <AmGroup rows={accountManagers} selected={selected} onSelect={onSelect} />
        ) : null}
      </div>
    </section>
  );
}

function TechGroup({
  title,
  kind,
  rows,
  selected,
  onSelect,
}: {
  title: string;
  kind: "permit" | "hoa";
  rows: TechBreakdownRow[];
  selected?: TechFilter;
  onSelect?: (next: TechFilter) => void;
}) {
  const { permitLabel, hoaLabel } = useTechLabel();
  const label = kind === "permit" ? permitLabel : hoaLabel;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => {
          const isOn = selected?.kind === kind && selected.tech === row.tech;
          return (
            <button
              key={row.tech}
              type="button"
              onClick={() => onSelect?.(isOn ? null : { kind, tech: row.tech })}
              className={cn(
                "flex w-full flex-col items-start gap-1 rounded-xl px-1.5 py-1.5 text-left hover:bg-muted/50",
                isOn ? "bg-primary/10" : "",
              )}
            >
              <span className="text-base font-medium">{label(row.tech)}</span>
              <div className="flex flex-wrap items-center gap-1">
                <span className={`${CHIP} bg-primary text-primary-foreground`}>{row.total} active</span>
                {row.needToSubmit > 0 && (
                  <span className={`${CHIP} ${FILL_PURPLE}`}>
                    {row.needToSubmit} need to submit
                  </span>
                )}
                {row.inReview > 0 && (
                  <span className={`${CHIP} ${FILL_BLUE}`}>
                    {row.inReview} in review
                  </span>
                )}
                {row.approved > 0 && (
                  <span className={`${CHIP} ${FILL_GREEN}`}>
                    {row.approved} approved
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AmGroup({
  rows,
  selected,
  onSelect,
}: {
  rows: AmBreakdownRow[];
  selected?: TechFilter;
  onSelect?: (next: TechFilter) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account managers</p>
        <Link href="/install" className="text-xs font-medium text-primary hover:underline">
          Open board
        </Link>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const isOn = selected?.kind === "am" && selected.id === row.id;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect?.(isOn ? null : { kind: "am", id: row.id, name: row.name })}
              className={cn(
                "flex w-full flex-col items-start gap-1 rounded-xl px-1.5 py-1.5 text-left hover:bg-muted/50",
                isOn ? "bg-primary/10" : "",
              )}
            >
              <span className="text-base font-medium">{row.name}</span>
              <div className="flex flex-wrap items-center gap-1">
                <span className={`${CHIP} bg-primary text-primary-foreground`}>{row.total} active</span>
                <span className={`${CHIP} ${FILL_PURPLE}`}>
                  {row.scheduled} scheduled
                </span>
                <span className={`${CHIP} ${FILL_BLUE}`}>
                  {row.inProgress} in progress
                </span>
                <span className={`${CHIP} ${FILL_GREEN}`}>
                  {row.pendingFinal} pending final
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
