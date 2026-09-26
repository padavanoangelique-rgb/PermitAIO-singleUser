"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { currency, STAGES, SUB_STATUSES, stageWhenOrdered } from "@/lib/inventory/constants";
import { materialEtaIsSoon } from "@/lib/inventory/eta";
import { STATUS_FILL, jobStatusFill } from "@/lib/ui/fills";
import { createClient } from "@/lib/supabase/client";
import { NO_HOA_TECH } from "@/lib/hoa/constants";
import { useTechSlots, useTechLabel } from "@/components/tech-slots-provider";

const statusTone: Record<string, string> = STATUS_FILL;

const JOB_BTN =
  "inline-flex h-8 w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold tabular-nums text-primary-foreground shadow-sm hover:opacity-90";
const STATUS_PILL =
  "inline-flex h-8 max-w-full items-center justify-center rounded-full px-2 text-xs font-semibold shadow-sm";
const SELECT = "h-8 w-full min-w-0 max-w-[8rem] rounded-full";
const PILL_TRIGGER =
  "h-8 w-full min-w-0 max-w-full justify-center gap-1 rounded-full border-0 px-2 text-xs font-semibold shadow-sm hover:opacity-90 [&_svg]:size-3.5 [&_svg]:text-current [&_svg]:opacity-80";
const DATE =
  "h-8 w-full min-w-0 max-w-[8.25rem] rounded-full border border-input bg-background px-2 text-xs tabular-nums";
const DATE_SQL =
  "Couldn't save that date. Run this in Supabase SQL first:\n\nalter table public.jobs add column if not exists ordered_date date, add column if not exists material_eta date;";

export type ViewerKind = "manager" | "permit" | "hoa" | "both" | "member";

function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <span className={`${STATUS_PILL} ${statusTone[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}

function JobStatusSelect({
  jobId,
  stage,
  onStageChange,
}: {
  jobId: string;
  stage: string | null;
  onStageChange?: (stage: string) => void;
}) {
  const [value, setValue] = useState(stage || STAGES[0]);
  useEffect(() => {
    if (stage) setValue(stage);
  }, [stage]);

  async function save(next: string) {
    const previous = value;
    setValue(next);
    onStageChange?.(next);
    const supabase = createClient();
    const { error } = await supabase.from("jobs").update({ stage: next }).eq("id", jobId);
    if (error) {
      setValue(previous);
      onStageChange?.(previous);
      alert(`Couldn't save job status: ${error.message}`);
    }
  }

  return (
    <Select value={value} onValueChange={(v) => void save(v)}>
      <SelectTrigger size="sm" aria-label="Job status" className={`${PILL_TRIGGER} ${jobStatusFill(value)}`}>
        <SelectValue placeholder="Job status" />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[80] max-h-72">
        {STAGES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PermitStatusSelect({ jobId, status }: { jobId: string; status: string | null }) {
  const [value, setValue] = useState(status || SUB_STATUSES[0]);
  useEffect(() => {
    if (status) setValue(status);
  }, [status]);

  async function save(next: string) {
    const previous = value;
    setValue(next);
    const supabase = createClient();
    const { error } = await supabase.from("jobs").update({ sub_status: next }).eq("id", jobId);
    if (error) {
      setValue(previous);
      alert(`Couldn't save permit status: ${error.message}`);
    }
  }

  return (
    <Select value={value} onValueChange={(v) => void save(v)}>
      <SelectTrigger
        size="sm"
        aria-label="Permit status"
        className={`${PILL_TRIGGER} ${statusTone[value] ?? "bg-muted text-muted-foreground"}`}
      >
        <SelectValue placeholder="Permit status" />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[80]">
        {SUB_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type JobRow = {
  id: string;
  job_number: string | null;
  client_name: string | null;
  city: string | null;
  trade_type: string | null;
  jurisdiction: string | null;
  stage: string | null;
  sub_status: string | null;
  permit_number: string | null;
  permit_updated_at: string | null;
  permit_tech: string | null;
  hoa_tech: string | null;
  hoa_job_id: string | null;
  hoa_name: string | null;
  hoa_status: string | null;
  hoa_updated_at: string | null;
  hoa_assigned_to: string | null;
  account_manager_id?: string | null;
  contract_value?: number | null;
  ordered_date?: string | null;
  material_eta?: string | null;
  agentTouched?: boolean;
};

function permitValue(slot: string | null, permitTechs: string[]) {
  if (slot && permitTechs.includes(slot)) return slot;
  return permitTechs[0] ?? "";
}

function hoaValue(slot: string | null, hoaTechs: string[]) {
  if (!slot) return "unassigned";
  if (slot === NO_HOA_TECH || slot === "unassigned") return slot;
  if (hoaTechs.includes(slot)) return slot;
  return "unassigned";
}

function PermitTechSelect({
  jobId,
  permitTech,
  canAssign,
}: {
  jobId: string;
  permitTech: string | null;
  canAssign: boolean;
}) {
  const { permitTechs } = useTechSlots();
  const { permitLabel } = useTechLabel();
  const [permit, setPermit] = useState(permitValue(permitTech, permitTechs));

  async function save(nextTech: string) {
    const previous = permit;
    setPermit(nextTech);
    const supabase = createClient();
    const { error } = await supabase.from("jobs").update({ permit_tech: nextTech }).eq("id", jobId);
    if (error) {
      setPermit(previous);
      alert(`Couldn't reassign the permit tech: ${error.message}`);
    }
  }

  if (!canAssign) return <span className="text-sm">{permitLabel(permitTech) || "—"}</span>;

  return (
    <Select value={permit} onValueChange={(v) => void save(v)}>
      <SelectTrigger size="sm" className={SELECT} aria-label="Permit tech">
        <SelectValue placeholder="Permit tech" />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[80]">
        {permitTechs.map((tech) => (
          <SelectItem key={tech} value={tech}>
            {permitLabel(tech)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function HoaTechSelect({
  jobId,
  hoaJobId,
  hoaTech,
  canAssign,
}: {
  jobId: string;
  hoaJobId: string | null;
  hoaTech: string | null;
  canAssign: boolean;
}) {
  const { hoaTechs } = useTechSlots();
  const { hoaLabel } = useTechLabel();
  const [hoa, setHoa] = useState(hoaValue(hoaTech, hoaTechs));

  async function save(nextTech: string) {
    const previous = hoa;
    const value = nextTech === "unassigned" ? "" : nextTech;
    setHoa(nextTech);
    const supabase = createClient();
    const jobUpdate = await supabase.from("jobs").update({ hoa_tech: value }).eq("id", jobId);
    if (jobUpdate.error) {
      const { error: hoaErr } = hoaJobId
        ? await supabase.from("hoa_jobs").update({ assigned_to: value === NO_HOA_TECH ? "" : value }).eq("id", hoaJobId)
        : { error: jobUpdate.error };
      if (hoaErr && !hoaJobId) {
        setHoa(previous);
        alert("Couldn't save HOA tech. Run this in Supabase SQL first:\n\nalter table public.jobs add column if not exists hoa_tech text not null default '';");
        return;
      }
    } else if (hoaJobId && value && value !== NO_HOA_TECH) {
      await supabase.from("hoa_jobs").update({ assigned_to: value }).eq("id", hoaJobId);
    }
  }

  if (!canAssign) {
    if (hoa === "unassigned") return <span className="text-sm text-muted-foreground">—</span>;
    return <span className="text-sm">{hoaLabel(hoa)}</span>;
  }

  return (
    <Select value={hoa} onValueChange={(v) => void save(v)}>
      <SelectTrigger size="sm" className={SELECT} aria-label="HOA tech">
        <SelectValue placeholder="HOA tech" />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[80]">
        <SelectItem value="unassigned">Unassigned</SelectItem>
        <SelectItem value={NO_HOA_TECH}>{NO_HOA_TECH}</SelectItem>
        {hoaTechs.map((tech) => (
          <SelectItem key={tech} value={tech}>
            {hoaLabel(tech)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function cityOf(job: JobRow) {
  return job.city || job.jurisdiction || "—";
}

type SortKey =
  | "job"
  | "contract"
  | "client"
  | "city"
  | "jobStatus"
  | "permitStatus"
  | "permitTech"
  | "hoaStatus"
  | "hoaTech"
  | "ordered"
  | "eta";

const STAGE_RANK: Record<string, number> = Object.fromEntries(STAGES.map((s, i) => [s, i + 1]));

const PERMIT_RANK: Record<string, number> = {
  "Need to Submit": 1,
  "Quote Needed": 2,
  "Engineering Pending": 3,
  "In Review": 4,
  "Corrections Needed": 5,
  Approved: 6,
  "Approved and Printed": 7,
  Complete: 8,
};

const HOA_RANK: Record<string, number> = {
  "Need to Submit": 1,
  "In Review": 2,
  Approved: 3,
  "Approved and Printed": 4,
  Complete: 5,
  "NO HOA": 9,
};

function cmpText(a: string, b: string, dir: "asc" | "desc") {
  const r = a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? r : -r;
}

function cmpNum(a: number | null | undefined, b: number | null | undefined, dir: "asc" | "desc") {
  const aEmpty = a == null;
  const bEmpty = b == null;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return dir === "asc" ? a - b : b - a;
}

function SortHead({
  label,
  col,
  sort,
  onSort,
  className,
}: {
  label: string;
  col: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === col;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex max-w-full items-center gap-0.5 text-left font-medium hover:text-foreground"
      >
        <span className="leading-tight">{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : null}
      </button>
    </TableHead>
  );
}

function InfoDateSelect({
  jobId,
  field,
  value,
  canAssign,
  label,
  stage,
  onStageChange,
}: {
  jobId: string;
  field: "ordered_date" | "material_eta";
  value: string | null | undefined;
  canAssign: boolean;
  label: string;
  stage?: string | null;
  onStageChange?: (stage: string) => void;
}) {
  const [date, setDate] = useState(value ?? "");

  async function save(next: string) {
    const previous = date;
    setDate(next);
    const supabase = createClient();
    const payload: { ordered_date?: string | null; material_eta?: string | null; stage?: string } =
      field === "ordered_date" ? { ordered_date: next || null } : { material_eta: next || null };
    if (field === "ordered_date" && next) {
      const nextStage = stageWhenOrdered(stage);
      if (nextStage !== (stage ?? "")) payload.stage = nextStage;
    }
    const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
    if (error) {
      setDate(previous);
      alert(DATE_SQL);
      return;
    }
    if (payload.stage) onStageChange?.(payload.stage);
  }

  const soon = field === "material_eta" && materialEtaIsSoon(date);

  if (soon) {
    return (
      <span className="relative inline-flex h-8 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-semibold tabular-nums text-white">
        {shortDate(date)}
        {canAssign ? (
          <input
            type="date"
            value={date}
            aria-label={label}
            onChange={(e) => void save(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        ) : null}
      </span>
    );
  }

  if (!canAssign) {
    return <span className="text-sm tabular-nums text-muted-foreground">{shortDate(date || null)}</span>;
  }

  return (
    <input
      type="date"
      value={date}
      aria-label={label}
      onChange={(e) => void save(e.target.value)}
      className={DATE}
    />
  );
}

function HoaStatus({ job }: { job: JobRow }) {
  const hoaTech = job.hoa_tech || job.hoa_assigned_to;
  if (hoaTech === NO_HOA_TECH) return <span className={`${STATUS_PILL} bg-muted text-muted-foreground`}>NO HOA</span>;
  return <StatusBadge status={job.hoa_status} />;
}

function Money({ value }: { value: number | null | undefined }) {
  return (
    <span className="tabular-nums text-primary">{value != null ? currency(value) : "—"}</span>
  );
}

export function JobsTable({
  jobs,
  canAssign = false,
}: {
  jobs: JobRow[];
  canAssign?: boolean;
  viewerKind?: ViewerKind;
  statusKind?: "permit" | "hoa";
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [stageById, setStageById] = useState<Record<string, string>>({});
  const { permitLabel, hoaLabel } = useTechLabel();

  function stageOf(job: JobRow) {
    return stageById[job.id] ?? job.stage;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = !q
      ? [...jobs]
      : jobs.filter(
          (j) =>
            (j.job_number ?? "").toLowerCase().includes(q) ||
            (j.client_name ?? "").toLowerCase().includes(q) ||
            (j.permit_number ?? "").toLowerCase().includes(q) ||
            (j.stage ?? "").toLowerCase().includes(q) ||
            (stageById[j.id] ?? "").toLowerCase().includes(q) ||
            cityOf(j).toLowerCase().includes(q),
        );
    if (!sort) return rows;
    const dir = sort.dir;
    return rows.sort((a, b) => {
      switch (sort.key) {
        case "job":
          return cmpText(a.job_number ?? "", b.job_number ?? "", dir);
        case "contract":
          return cmpNum(a.contract_value, b.contract_value, dir);
        case "client":
          return cmpText(a.client_name ?? "", b.client_name ?? "", dir);
        case "city":
          return cmpText(cityOf(a), cityOf(b), dir);
        case "jobStatus":
          return cmpNum(STAGE_RANK[stageById[a.id] ?? a.stage ?? ""] ?? 99, STAGE_RANK[stageById[b.id] ?? b.stage ?? ""] ?? 99, dir);
        case "permitStatus":
          return cmpNum(PERMIT_RANK[a.sub_status ?? ""] ?? 99, PERMIT_RANK[b.sub_status ?? ""] ?? 99, dir);
        case "permitTech":
          return cmpText(permitLabel(a.permit_tech) || a.permit_tech || "", permitLabel(b.permit_tech) || b.permit_tech || "", dir);
        case "hoaStatus": {
          const as = a.hoa_tech === NO_HOA_TECH || a.hoa_assigned_to === NO_HOA_TECH ? "NO HOA" : a.hoa_status ?? "";
          const bs = b.hoa_tech === NO_HOA_TECH || b.hoa_assigned_to === NO_HOA_TECH ? "NO HOA" : b.hoa_status ?? "";
          return cmpNum(HOA_RANK[as] ?? 99, HOA_RANK[bs] ?? 99, dir);
        }
        case "hoaTech":
          return cmpText(
            hoaLabel(a.hoa_tech || a.hoa_assigned_to) || a.hoa_tech || a.hoa_assigned_to || "",
            hoaLabel(b.hoa_tech || b.hoa_assigned_to) || b.hoa_tech || b.hoa_assigned_to || "",
            dir,
          );
        case "ordered":
          return cmpText(a.ordered_date ?? "9999", b.ordered_date ?? "9999", dir);
        case "eta":
          return cmpText(a.material_eta ?? "9999", b.material_eta ?? "9999", dir);
        default:
          return 0;
      }
    });
  }, [jobs, query, sort, permitLabel, hoaLabel, stageById]);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by job #, client, city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 rounded-full pl-8"
          aria-label="Search jobs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {query ? <>No jobs match “{query}”.</> : "No jobs yet."}
        </p>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {filtered.map((job) => {
              const hoaTech = job.hoa_tech || job.hoa_assigned_to;
              return (
                <article key={job.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/jobs/${job.id}`} className={JOB_BTN}>
                      {job.job_number}
                    </Link>
                    <Money value={job.contract_value} />
                  </div>
                  <p className="mt-1 font-medium">{job.client_name || "—"}</p>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex gap-3">
                      <span className="w-28 shrink-0 text-muted-foreground">City</span>
                      <span>{cityOf(job)}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-28 shrink-0 text-muted-foreground">Job status</span>
                      <JobStatusSelect
                        jobId={job.id}
                        stage={stageOf(job)}
                        onStageChange={(stage) => setStageById((prev) => ({ ...prev, [job.id]: stage }))}
                      />
                    </div>
                    <div className="flex gap-3">
                      <span className="w-28 shrink-0 text-muted-foreground">Permit status</span>
                      <PermitStatusSelect jobId={job.id} status={job.sub_status} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-muted-foreground">Permit tech</span>
                      <PermitTechSelect jobId={job.id} permitTech={job.permit_tech} canAssign={canAssign} />
                    </div>
                    <div className="flex gap-3">
                      <span className="w-28 shrink-0 text-muted-foreground">HOA status</span>
                      <HoaStatus job={job} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-muted-foreground">HOA tech</span>
                      <HoaTechSelect jobId={job.id} hoaJobId={job.hoa_job_id} hoaTech={hoaTech} canAssign={canAssign} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-muted-foreground">Job ordered</span>
                      <InfoDateSelect
                        jobId={job.id}
                        field="ordered_date"
                        value={job.ordered_date}
                        canAssign={canAssign}
                        label="Job ordered"
                        stage={stageOf(job)}
                        onStageChange={(stage) => setStageById((prev) => ({ ...prev, [job.id]: stage }))}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-muted-foreground">Material ETA</span>
                      <InfoDateSelect
                        jobId={job.id}
                        field="material_eta"
                        value={job.material_eta}
                        canAssign={canAssign}
                        label="Material ETA"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Job #" col="job" sort={sort} onSort={toggleSort} className="w-[6.5rem] px-2" />
                  <SortHead label="Contract" col="contract" sort={sort} onSort={toggleSort} className="w-[5.5rem] px-2" />
                  <SortHead label="Client" col="client" sort={sort} onSort={toggleSort} className="w-[10.5rem] px-2 pr-1" />
                  <SortHead label="City" col="city" sort={sort} onSort={toggleSort} className="w-[11.5rem] px-2 pl-1" />
                  <SortHead label="Job status" col="jobStatus" sort={sort} onSort={toggleSort} className="w-[9.5rem] px-2" />
                  <SortHead label="Permit status" col="permitStatus" sort={sort} onSort={toggleSort} className="w-[8.5rem] px-2" />
                  <SortHead label="Permit tech" col="permitTech" sort={sort} onSort={toggleSort} className="w-[8.5rem] px-2" />
                  <SortHead label="HOA status" col="hoaStatus" sort={sort} onSort={toggleSort} className="w-[7.5rem] px-2" />
                  <SortHead label="HOA tech" col="hoaTech" sort={sort} onSort={toggleSort} className="w-[8.5rem] px-2" />
                  <SortHead label="Job ordered" col="ordered" sort={sort} onSort={toggleSort} className="w-[8.5rem] whitespace-normal px-2 leading-tight" />
                  <SortHead label="Material ETA" col="eta" sort={sort} onSort={toggleSort} className="w-[8.5rem] whitespace-normal px-2 leading-tight" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((job) => {
                  const hoaTech = job.hoa_tech || job.hoa_assigned_to;
                  return (
                    <TableRow key={job.id} className="border-0 hover:bg-muted/40">
                      <TableCell className="px-2 py-1.5">
                        <Link href={`/jobs/${job.id}`} className={JOB_BTN}>
                          {job.job_number}
                        </Link>
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <Money value={job.contract_value} />
                      </TableCell>
                      <TableCell className="truncate px-2 pr-1 py-1.5 font-medium">{job.client_name || "—"}</TableCell>
                      <TableCell className="whitespace-normal px-2 pl-1 py-1.5 leading-snug text-muted-foreground">{cityOf(job)}</TableCell>
                      <TableCell className="min-w-0 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <JobStatusSelect
                          jobId={job.id}
                          stage={stageOf(job)}
                          onStageChange={(stage) => setStageById((prev) => ({ ...prev, [job.id]: stage }))}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <PermitStatusSelect jobId={job.id} status={job.sub_status} />
                      </TableCell>
                      <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <PermitTechSelect jobId={job.id} permitTech={job.permit_tech} canAssign={canAssign} />
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <HoaStatus job={job} />
                      </TableCell>
                      <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <HoaTechSelect jobId={job.id} hoaJobId={job.hoa_job_id} hoaTech={hoaTech} canAssign={canAssign} />
                      </TableCell>
                      <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <InfoDateSelect
                          jobId={job.id}
                          field="ordered_date"
                          value={job.ordered_date}
                          canAssign={canAssign}
                          label="Job ordered"
                          stage={stageOf(job)}
                          onStageChange={(stage) => setStageById((prev) => ({ ...prev, [job.id]: stage }))}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <InfoDateSelect
                          jobId={job.id}
                          field="material_eta"
                          value={job.material_eta}
                          canAssign={canAssign}
                          label="Material ETA"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length !== jobs.length ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {filtered.length} of {jobs.length}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
