"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NO_HOA_TECH } from "@/lib/hoa/constants";
import { useTechLabel } from "@/components/tech-slots-provider";

export type AgingJob = {
  id: string;
  job_number: string | null;
  client_name: string | null;
  jurisdiction: string | null;
  trade_type: string | null;
  permit_tech: string | null;
  hoa_tech: string | null;
  permitDays: number | null;
  hoaDays: number | null;
  agentNote: string | null;
};

export const AGING_THRESHOLD_DAYS = 14;

type TechBucket = {
  key: string;
  label: string;
  rows: AgingJob[];
};

function buckets(
  jobs: AgingJob[],
  kind: "permit" | "hoa",
  keyOf: (job: AgingJob) => string | null,
  labelOf: (slot: string) => string,
): TechBucket[] {
  const map = new Map<string, { slot: string; rows: AgingJob[] }>();
  for (const job of jobs) {
    const raw = keyOf(job);
    if (!raw || raw === NO_HOA_TECH) continue;
    const key = `${kind}:${raw}`;
    const list = map.get(key) ?? { slot: raw, rows: [] };
    list.rows.push(job);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, { slot, rows }]) => ({ key, label: labelOf(slot) || slot, rows }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function TechGroup({
  title,
  groups,
  openKey,
  onToggle,
}: {
  title: string;
  groups: TechBucket[];
  openKey: string | null;
  onToggle: (key: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {groups.map((group) => {
        const open = openKey === group.key;
        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => onToggle(group.key)}
              className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-muted/50"
              aria-expanded={open}
            >
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
              <span className="min-w-0 flex-1 truncate font-medium">{group.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{group.rows.length}</span>
            </button>
            {open ? (
              <ul className="mb-1 ml-6 space-y-0.5">
                {group.rows.map((job) => (
                  <li key={`${group.key}-${job.id}`}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-medium tabular-nums text-primary">{job.job_number ?? "Untitled"}</span>
                        <span className="truncate text-muted-foreground">{job.client_name}</span>
                      </span>
                      {job.agentNote ? (
                        <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-400">
                          {job.agentNote}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AgingAlerts({ jobs }: { jobs: AgingJob[] }) {
  const { permitLabel, hoaLabel } = useTechLabel();
  const [open, setOpen] = useState(false);
  const [openTech, setOpenTech] = useState<string | null>(null);

  const permitGroups = useMemo(
    () => buckets(jobs, "permit", (j) => j.permit_tech, permitLabel),
    [jobs, permitLabel],
  );
  const hoaGroups = useMemo(
    () => buckets(jobs, "hoa", (j) => j.hoa_tech, hoaLabel),
    [jobs, hoaLabel],
  );

  if (jobs.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center gap-2 px-3 text-left"
        aria-expanded={open}
      >
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="font-heading text-sm font-semibold">Needs attention</span>
        <span className="text-xs tabular-nums text-muted-foreground">{jobs.length}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <TechGroup
            title="Permit techs"
            groups={permitGroups}
            openKey={openTech}
            onToggle={(key) => setOpenTech((cur) => (cur === key ? null : key))}
          />
          <TechGroup
            title="HOA techs"
            groups={hoaGroups}
            openKey={openTech}
            onToggle={(key) => setOpenTech((cur) => (cur === key ? null : key))}
          />
        </div>
      ) : null}
    </section>
  );
}
