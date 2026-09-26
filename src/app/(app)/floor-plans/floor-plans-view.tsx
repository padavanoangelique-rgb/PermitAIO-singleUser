"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { FileText, PackageCheck, Ruler, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTechLabel, useTechSlots } from "@/components/tech-slots-provider";
import { cn } from "@/lib/utils";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

export type FloorPlanRow = {
  id: string;
  job_number: string | null;
  client_name: string | null;
  trade_type: string | null;
  address: string | null;
  permit_tech: string | null;
  hoa_tech: string | null;
  plan_version: number | null;
  plan_updated_at: string | null;
  submitted: boolean;
};

type PlanFilter = "all" | "drawn" | "blank";
type TechPick = { kind: "permit" | "hoa"; tech: string } | null;

function planAge(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(mins) || mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const BTN =
  "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm sm:h-8";
const JOB_BTN =
  "inline-flex h-11 w-28 shrink-0 items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold tabular-nums text-primary-foreground hover:opacity-90 sm:h-8";
const SUBMITTED_PILL =
  "inline-flex h-6 w-[7.75rem] shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold";
const FORMS_BTN = `${BTN} bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400`;
const PLAN_BTN = `${BTN} bg-primary text-primary-foreground hover:bg-primary/90`;
const PACKAGE_BTN = `${BTN} bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400`;
const TECH_CHIP =
  "inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold shadow-sm sm:h-8";

type TechRow = {
  tech: string;
  total: number;
  blank: number;
  drawn: number;
  submitted: number;
};

function rollup(techs: string[], jobs: FloorPlanRow[], key: "permit_tech" | "hoa_tech"): TechRow[] {
  return techs.map((tech) => {
    const mine = jobs.filter((job) => job[key] === tech);
    return {
      tech,
      total: mine.length,
      blank: mine.filter((job) => !job.plan_updated_at).length,
      drawn: mine.filter((job) => job.plan_updated_at).length,
      submitted: mine.filter((job) => job.submitted).length,
    };
  });
}

function BuilderTechPanel({
  permitRows,
  hoaRows,
  selected,
  onSelect,
}: {
  permitRows: TechRow[];
  hoaRows: TechRow[];
  selected: TechPick;
  onSelect: (next: TechPick) => void;
}) {
  const { permitLabel, hoaLabel } = useTechLabel();
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <TechNameGroup
        title="Permit techs"
        kind="permit"
        rows={permitRows}
        label={permitLabel}
        selected={selected}
        onSelect={onSelect}
      />
      <TechNameGroup
        title="HOA techs"
        kind="hoa"
        rows={hoaRows}
        label={hoaLabel}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

function TechNameGroup({
  title,
  kind,
  rows,
  label,
  selected,
  onSelect,
}: {
  title: string;
  kind: "permit" | "hoa";
  rows: TechRow[];
  label: (slot: string | null | undefined) => string;
  selected: TechPick;
  onSelect: (next: TechPick) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => {
          const on = selected?.kind === kind && selected.tech === row.tech;
          return (
            <button
              key={row.tech}
              type="button"
              onClick={() => onSelect(on ? null : { kind, tech: row.tech })}
              className={cn(
                "flex w-full flex-col items-start gap-1.5 rounded-xl px-2 py-2 text-left hover:bg-muted/50",
                on ? "bg-primary/10" : "",
              )}
            >
              <span className="text-base font-medium">{label(row.tech) || row.tech}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`${TECH_CHIP} bg-primary text-primary-foreground`}>{row.total} jobs</span>
                <span className={`${TECH_CHIP} ${FILL_PURPLE}`}>
                  {row.blank} no plan
                </span>
                <span className={`${TECH_CHIP} ${FILL_BLUE}`}>
                  {row.drawn} plan on file
                </span>
                <span className={`${TECH_CHIP} ${FILL_GREEN}`}>
                  {row.submitted} submitted
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FloorPlansView({ jobs }: { jobs: FloorPlanRow[] }) {
  const { permitTechs, hoaTechs } = useTechSlots();
  const { permitLabel, hoaLabel } = useTechLabel();
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [tech, setTech] = useState<TechPick>(null);

  const drawnCount = jobs.filter((j) => j.plan_updated_at).length;
  const blankCount = jobs.length - drawnCount;
  const permitRows = useMemo(() => rollup(permitTechs, jobs, "permit_tech"), [permitTechs, jobs]);
  const hoaRows = useMemo(() => rollup(hoaTechs, jobs, "hoa_tech"), [hoaTechs, jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (planFilter === "drawn" && !job.plan_updated_at) return false;
      if (planFilter === "blank" && job.plan_updated_at) return false;
      if (tech?.kind === "permit" && job.permit_tech !== tech.tech) return false;
      if (tech?.kind === "hoa" && job.hoa_tech !== tech.tech) return false;
      if (!q) return true;
      const hay = `${job.job_number ?? ""} ${job.client_name ?? ""} ${job.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, query, planFilter, tech]);

  const techName = tech
    ? tech.kind === "permit"
      ? permitLabel(tech.tech) || tech.tech
      : hoaLabel(tech.tech) || tech.tech
    : null;

  return (
    <div className="space-y-3">
      <BuilderTechPanel permitRows={permitRows} hoaRows={hoaRows} selected={tech} onSelect={setTech} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Job, client, address"
            className="h-9 pl-8"
            aria-label="Search jobs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          <Chip active={planFilter === "all"} onClick={() => setPlanFilter("all")}>
            All {jobs.length}
          </Chip>
          <Chip active={planFilter === "drawn"} onClick={() => setPlanFilter("drawn")}>
            Drawn {drawnCount}
          </Chip>
          <Chip active={planFilter === "blank"} onClick={() => setPlanFilter("blank")}>
            Not started {blankCount}
          </Chip>
        </div>
      </div>

      {tech ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing jobs assigned to {tech.kind === "permit" ? "permit tech" : "HOA tech"}{" "}
            <span className="font-medium text-foreground">{techName}</span>
            . Same floor plan for both.
          </span>
          <button type="button" onClick={() => setTech(null)} className="h-11 px-2 text-sm font-medium text-primary sm:h-8">
            Clear filter
          </button>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="space-y-0.5">
          {filtered.map((job) => {
            const started = Boolean(job.plan_updated_at);
            return (
              <div
                key={job.id}
                className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl px-2 py-2 hover:bg-muted/50 sm:grid-cols-[7rem_minmax(0,1fr)_7.75rem_auto] xl:grid-cols-[7rem_minmax(0,1fr)_7.75rem_6rem_auto]"
              >
                <Link href={`/jobs/${job.id}`} className={JOB_BTN}>
                  {job.job_number}
                </Link>
                <span className="min-w-0">
                  <span className="block truncate font-medium leading-tight">{job.client_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {job.address ?? "—"}
                  </span>
                </span>
                <span
                  className={`${SUBMITTED_PILL} col-span-2 sm:col-span-1 ${
                    job.submitted
                      ? FILL_GREEN
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {job.submitted ? "Submitted" : "Not submitted"}
                </span>
                <span className="hidden w-24 text-right text-xs text-muted-foreground xl:block">
                  {started ? `v${job.plan_version} · ${planAge(job.plan_updated_at!)}` : "Not started"}
                </span>
                <div className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1 sm:justify-end">
                  <Link href={`/jobs/${job.id}?tab=forms`} className={FORMS_BTN}>
                    <FileText className="h-3.5 w-3.5" />
                    Forms Generator
                  </Link>
                  <Link href={`/jobs/${job.id}/floor-plan`} className={PLAN_BTN}>
                    <Ruler className="h-3.5 w-3.5" />
                    Floor Plans
                  </Link>
                  <Link href={`/jobs/${job.id}?tab=package`} className={PACKAGE_BTN}>
                    <PackageCheck className="h-3.5 w-3.5" />
                    Permit Package
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-2 py-10 text-center text-sm text-muted-foreground">
          {query || tech || planFilter !== "all" ? "No jobs match this filter." : "No jobs yet."}
        </p>
      )}
    </div>
  );
}
