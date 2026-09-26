"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import type { KpiTone } from "@/components/ui/kpi-card";
import { Briefcase, Clock, FileCheck2, PackageCheck, Send } from "lucide-react";

export type JobsKpis = {
  totalActive: number;
  needToSubmit: number;
  inReview: number;
  approved: number;
  agingCount: number;
};

export type JobsKpiFilter = keyof JobsKpis;

const CARD_DEFS: {
  key: JobsKpiFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: KpiTone;
}[] = [
  { key: "totalActive", label: "Active jobs", icon: Briefcase, tone: "neutral" },
  { key: "needToSubmit", label: "Need to submit", icon: Send, tone: "accent" },
  { key: "inReview", label: "In review", icon: FileCheck2, tone: "info" },
  { key: "approved", label: "Approved / printed", icon: PackageCheck, tone: "good" },
  { key: "agingCount", label: "Needs attention", icon: Clock, tone: "danger" },
];

export function JobsKpiStrip({
  kpis,
  activeFilter,
  onFilterChange,
}: {
  kpis: JobsKpis;
  activeFilter: JobsKpiFilter | null;
  onFilterChange: (key: JobsKpiFilter | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 print:hidden sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {CARD_DEFS.map(({ key, label, icon, tone }) => {
        const active = activeFilter === key;
        return (
          <KpiCard
            key={key}
            label={label}
            value={kpis[key]}
            icon={icon}
            tone={tone}
            active={active}
            onClick={() => onFilterChange(active ? null : key)}
          />
        );
      })}
    </div>
  );
}
