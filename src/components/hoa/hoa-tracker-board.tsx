"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  Send,
  Upload,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { HOA_JOB_STATUSES } from "@/lib/hoa/constants";
import { displayNameOnly } from "@/lib/tech-labels";
import { useTechSlots } from "@/components/tech-slots-provider";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import type { KpiTone } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BoardSkeleton } from "@/components/ui/loading-skeletons";
import { HoaCsvUploadForm } from "./hoa-csv-upload-form";
import { HoaDetail } from "./hoa-detail";
import { HoaJobModal } from "./hoa-job-modal";
import { HoaModal } from "./hoa-modal";
import { HoaJobsReport, HoaReport } from "./hoa-reports";
import { HoaDirectory } from "./hoa-directory";
import { HoaJobRow, HOA_JOB_GRID } from "./hoa-job-row";
import { STATUS_FILL } from "@/lib/ui/fills";

type Hoa = Tables<"hoas">;
type HoaJob = Tables<"hoa_jobs">;
type HoaDocument = Tables<"hoa_documents">;

const STATUS_KPI_META: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: KpiTone }> = {
  "Need to Submit": { icon: Send, tone: "accent" },
  "In Review": { icon: FileCheck2, tone: "info" },
  Approved: { icon: CheckCircle2, tone: "good" },
  "Approved and Printed": { icon: Printer, tone: "good" },
  Complete: { icon: CheckCheck, tone: "primary" },
};

function dateLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export function HoaTrackerBoard({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [hoas, setHoas] = useState<Hoa[]>([]);
  const [jobs, setJobs] = useState<HoaJob[]>([]);
  const [jobDates, setJobDates] = useState<
    Record<string, { ordered: string | null; eta: string | null; sub_status: string | null; stage: string | null }>
  >({});
  const [documents, setDocuments] = useState<HoaDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"jobs" | "directory">("jobs");
  const [selectedHoaId, setSelectedHoaId] = useState<string | null>(null);
  const [selectedSpineId, setSelectedSpineId] = useState<string | null>(null);
  const [jobSearch, setJobSearch] = useState("");
  const [jobsFilter, setJobsFilter] = useState<string>("All");
  const [techFilter, setTechFilter] = useState<string>("All");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [printTarget, setPrintTarget] = useState<"hoa" | "jobs">("jobs");

  const [hoaModal, setHoaModal] = useState<{ open: boolean; hoa: Hoa | null }>({ open: false, hoa: null });
  const [jobModal, setJobModal] = useState<{ open: boolean; job: HoaJob | null; defaultHoaId: string | null }>({
    open: false,
    job: null,
    defaultHoaId: null,
  });
  const [csvModal, setCsvModal] = useState<{ open: boolean; mode: "hoa" | "job" }>({ open: false, mode: "hoa" });
  const { hoaTechs, hoaNames } = useTechSlots();

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [hoasRes, jobsRes, docsRes, datesRes] = await Promise.all([
      supabase.from("hoas").select("*").eq("org_id", orgId).order("name", { ascending: true }),
      supabase.from("hoa_jobs").select("*").eq("org_id", orgId).order("date_submitted", { ascending: true }),
      supabase.from("hoa_documents").select("*").eq("org_id", orgId).order("uploaded_at", { ascending: false }),
      supabase.from("jobs").select("id, ordered_date, material_eta, sub_status, stage").eq("org_id", orgId),
    ]);
    setHoas(hoasRes.data ?? []);
    setJobs(jobsRes.data ?? []);
    setDocuments(docsRes.data ?? []);
    const next: Record<string, { ordered: string | null; eta: string | null; sub_status: string | null; stage: string | null }> = {};
    for (const row of datesRes.data ?? []) {
      next[row.id] = {
        ordered: row.ordered_date,
        eta: row.material_eta,
        sub_status: row.sub_status,
        stage: row.stage,
      };
    }
    setJobDates(next);
    setLoading(false);
  }, [orgId]);
  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedHoa = hoas.find((h) => h.id === selectedHoaId) ?? null;

  const statCounts = useMemo(
    () => ({
      totalJobs: jobs.length,
      byStatus: Object.fromEntries(HOA_JOB_STATUSES.map((s) => [s, jobs.filter((j) => j.status === s).length])) as Record<
        string,
        number
      >,
    }),
    [jobs],
  );

  const techCounts = useMemo(
    () => Object.fromEntries(hoaTechs.map((t) => [t, jobs.filter((j) => j.assigned_to === t).length])),
    [jobs, hoaTechs],
  );

  const jq = jobSearch.toLowerCase().trim();
  const jobRows = useMemo(
    () =>
      jobs
        .filter((j) => jobsFilter === "All" || j.status === jobsFilter)
        .filter((j) => techFilter === "All" || j.assigned_to === techFilter)
        .filter((j) => {
          if (!jq) return true;
          const hoa = hoas.find((h) => h.id === j.hoa_id);
          return (
            (j.job_number ?? "").toLowerCase().includes(jq) ||
            (j.job_name ?? "").toLowerCase().includes(jq) ||
            j.address.toLowerCase().includes(jq) ||
            (hoa?.name ?? "").toLowerCase().includes(jq)
          );
        })
        .sort((a, b) => (a.date_submitted ?? "").localeCompare(b.date_submitted ?? "")),
    [jobs, jobsFilter, techFilter, jq, hoas],
  );

  const byStatus = useMemo(() => {
    const map: Record<string, HoaJob[]> = {};
    for (const status of HOA_JOB_STATUSES) map[status] = [];
    for (const job of jobRows) {
      const key = HOA_JOB_STATUSES.includes(job.status as (typeof HOA_JOB_STATUSES)[number])
        ? (job.status as string)
        : "Need to Submit";
      (map[key] ??= []).push(job);
    }
    return map;
  }, [jobRows]);

  const narrowed = jobsFilter !== "All" || techFilter !== "All" || Boolean(jq);

  function goToJobsFilter(status: string) {
    setJobsFilter(status);
    setTechFilter("All");
    setJobSearch("");
    setView("jobs");
  }

  async function deleteHoa(hoa: Hoa) {
    if (!confirm("Delete this HOA and all its linked jobs and documents? This cannot be undone.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("hoas").delete().eq("id", hoa.id).eq("org_id", orgId);
    if (error) return alert(`Couldn't delete that HOA: ${error.message}`);
    if (selectedHoaId === hoa.id) setSelectedHoaId(null);
    await loadData();
  }
  async function deleteHoaJob(job: HoaJob) {
    if (!confirm("Delete this job?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("hoa_jobs").delete().eq("id", job.id).eq("org_id", orgId);
    if (error) return alert(`Couldn't delete that job: ${error.message}`);
    setJobs((previous) => previous.filter((j) => j.id !== job.id));
  }

  const hoaOptions = useMemo(() => hoas.map((h) => ({ id: h.id, name: h.name, mgmt_co: h.mgmt_co })), [hoas]);

  const printFilterLabel = useMemo(() => {
    const parts = [];
    if (jobsFilter !== "All") parts.push(jobsFilter);
    if (techFilter !== "All") parts.push(techFilter);
    return parts.length ? parts.join(" — ") : "All Jobs";
  }, [jobsFilter, techFilter]);

  return (
    <>
      <div className="space-y-3 print:hidden">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">{orgName}</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">HOA Tracker</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">As of {dateLabel()}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-10 rounded-full pl-8"
                placeholder="Job #, client, HOA"
                value={jobSearch}
                onChange={(event) => {
                  setJobSearch(event.target.value);
                  setView("jobs");
                }}
              />
            </div>
            <Button
              onClick={() => {
                if (hoas.length === 0) return alert("Open HOA Directory and add an association first.");
                setJobModal({ open: true, job: null, defaultHoaId: null });
              }}
            >
              <Plus /> Add job
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setCsvModal({ open: true, mode: "job" })}>
                  <Upload /> Upload jobs CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setHoaModal({ open: true, hoa: null })}>
                  <Plus /> New HOA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setPrintTarget("jobs");
                    requestAnimationFrame(() => window.print());
                  }}
                >
                  <Printer /> Print report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <KpiCard
            label="Total Jobs"
            value={statCounts.totalJobs}
            icon={Briefcase}
            tone="primary"
            active={view === "jobs" && jobsFilter === "All"}
            onClick={() => goToJobsFilter("All")}
          />
          {HOA_JOB_STATUSES.map((status) => (
            <KpiCard
              key={status}
              label={status}
              value={statCounts.byStatus[status] ?? 0}
              icon={STATUS_KPI_META[status]?.icon}
              tone={STATUS_KPI_META[status]?.tone}
              active={view === "jobs" && jobsFilter === status}
              onClick={() => goToJobsFilter(status)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterButton
            active={techFilter === "All"}
            onClick={() => {
              setTechFilter("All");
              setView("jobs");
            }}
          >
            All ({jobs.length})
          </FilterButton>
          {hoaTechs.map((tech) => (
            <FilterButton
              key={tech}
              active={techFilter === tech}
              onClick={() => {
                setTechFilter(tech);
                setView("jobs");
              }}
            >
              {displayNameOnly(tech, hoaNames)} ({techCounts[tech] ?? 0})
            </FilterButton>
          ))}
          <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
          <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>
            Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set(HOA_JOB_STATUSES))}>
            Collapse all
          </Button>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              variant={view === "directory" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setView((current) => (current === "directory" ? "jobs" : "directory"))}
            >
              <Building2 /> HOA Directory
            </Button>
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {view === "directory"
            ? "Click an association to open your company's files, forms, and notes."
            : `${jobRows.length} jobs${statCounts.byStatus.Complete > 0 && jobsFilter !== "Complete" ? ` · ${statCounts.byStatus.Complete} complete` : ""}`}
        </p>
      </div>

      <div className="print:hidden">
        {view === "directory" ? (
          selectedHoa ? (
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setSelectedHoaId(null);
                  setSelectedSpineId(null);
                }}
              >
                ← Back to directory
              </Button>
              <HoaDetail
                hoa={selectedHoa}
                jobs={jobs.filter((j) => j.hoa_id === selectedHoa.id)}
                documents={documents.filter((d) => d.hoa_id === selectedHoa.id)}
                orgId={orgId}
                spineId={selectedSpineId}
                onEdit={() => setHoaModal({ open: true, hoa: selectedHoa })}
                onDelete={() => deleteHoa(selectedHoa)}
                onAddJob={() => setJobModal({ open: true, job: null, defaultHoaId: selectedHoa.id })}
                onJobPatched={(next) => setJobs((prev) => prev.map((j) => (j.id === next.id ? next : j)))}
                onDeleteJob={deleteHoaJob}
                onDocsChanged={async () => {
                  const supabase = createClient();
                  const { data } = await supabase.from("hoa_documents").select("*").eq("org_id", orgId).order("uploaded_at", { ascending: false });
                  setDocuments(data ?? []);
                  const { data: jobRowsData } = await supabase.from("hoa_jobs").select("*").eq("org_id", orgId);
                  if (jobRowsData) setJobs(jobRowsData);
                }}
                onHoaPatched={(next) => setHoas((prev) => prev.map((h) => (h.id === next.id ? next : h)))}
              />
            </div>
          ) : (
            <HoaDirectory
              selectedSpineId={selectedSpineId}
              onOpened={(hoa) => {
                void loadData();
                setSelectedHoaId(hoa.id);
                setSelectedSpineId(hoa.spineId);
              }}
            />
          )
        ) : loading ? (
          <BoardSkeleton stages={5} />
        ) : (
          <div className="space-y-4">
            {HOA_JOB_STATUSES.filter((status) => !narrowed || (byStatus[status] ?? []).length > 0).map((status) => {
              const stageJobs = byStatus[status] ?? [];
              const isCollapsed = collapsed.has(status);
              return (
                <div key={status} id={`hoa-status-${status.replace(/[^a-zA-Z0-9]/g, "-")}`} className="scroll-mt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((previous) => {
                        const next = new Set(previous);
                        if (next.has(status)) next.delete(status);
                        else next.add(status);
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={`flex flex-1 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-bold shadow-sm sm:text-base ${STATUS_FILL[status] ?? "bg-muted text-muted-foreground"}`}>
                      {status}
                      <span className="ml-2 tabular-nums font-bold opacity-90">({stageJobs.length})</span>
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      <div className={`${HOA_JOB_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
                        <span />
                        <span>Job #</span>
                        <span>Client</span>
                        <span>HOA</span>
                        <span>HOA status</span>
                        <span>Job status</span>
                        <span className="text-center">Asgn</span>
                        <span className="text-center">Sub</span>
                        <span className="text-center">Appr</span>
                        <span className="text-center">Ord</span>
                        <span className="text-center">ETA</span>
                        <span />
                      </div>
                      {stageJobs.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">No jobs</p>
                      ) : (
                        stageJobs.map((job) => (
                          <HoaJobRow
                            key={job.id}
                            job={job}
                            hoa={hoas.find((h) => h.id === job.hoa_id)}
                            dates={job.job_id ? jobDates[job.job_id] : null}
                            documents={documents.filter((d) => d.hoa_id === job.hoa_id)}
                            orgId={orgId}
                            hoas={hoaOptions}
                            onHoaCreated={(created) => setHoas((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))}
                            onDocsChanged={async () => {
                  const supabase = createClient();
                  const { data } = await supabase.from("hoa_documents").select("*").eq("org_id", orgId).order("uploaded_at", { ascending: false });
                  setDocuments(data ?? []);
                  const { data: jobRowsData } = await supabase.from("hoa_jobs").select("*").eq("org_id", orgId);
                  if (jobRowsData) setJobs(jobRowsData);
                }}
                            onJobPatched={(next) => setJobs((prev) => prev.map((j) => (j.id === next.id ? next : j)))}
                            onLinkedDates={(id, next) =>
                              setJobDates((prev) => ({
                                ...prev,
                                [id]: {
                                  ordered: next.ordered,
                                  eta: next.eta,
                                  sub_status: next.sub_status ?? prev[id]?.sub_status ?? null,
                                  stage: next.stage ?? prev[id]?.stage ?? null,
                                },
                              }))
                            }
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <HoaModal
        open={hoaModal.open}
        onOpenChange={(open) => setHoaModal((s) => ({ ...s, open }))}
        orgId={orgId}
        hoa={hoaModal.hoa}
        onSaved={(hoa) => {
          setHoas((prev) =>
            hoaModal.hoa
              ? prev.map((h) => (h.id === hoa.id ? hoa : h))
              : [...prev, hoa].sort((a, b) => a.name.localeCompare(b.name)),
          );
          setSelectedHoaId(hoa.id);
        }}
      />
      <HoaJobModal
        open={jobModal.open}
        onOpenChange={(open) => setJobModal((s) => ({ ...s, open }))}
        orgId={orgId}
        hoas={hoaOptions}
        hoaJob={jobModal.job}
        defaultHoaId={jobModal.defaultHoaId}
        onSaved={(row) =>
          setJobs((prev) => (jobModal.job ? prev.map((j) => (j.id === row.id ? row : j)) : [...prev, row]))
        }
        onHoaCreated={(created) => setHoas((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))}
      />
      <HoaCsvUploadForm
        open={csvModal.open}
        onOpenChange={(open) => setCsvModal((s) => ({ ...s, open }))}
        mode={csvModal.mode}
        orgId={orgId}
        hoas={hoas}
        onImported={loadData}
      />

      {printTarget === "hoa" && selectedHoa && (
        <HoaReport hoa={selectedHoa} jobs={jobs.filter((j) => j.hoa_id === selectedHoa.id)} orgName={orgName} />
      )}
      {printTarget === "jobs" && (
        <HoaJobsReport jobs={jobRows} hoas={hoas} filterLabel={printFilterLabel} orgName={orgName} />
      )}
    </>
  );
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button size="sm" variant={active ? "default" : "ghost"} className="h-8 rounded-full px-3" onClick={onClick}>
      {children}
    </Button>
  );
}
