"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Briefcase, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, Clock, DollarSign, Download, FileCheck2, FolderDown, MoreHorizontal, Plus, Printer, Search, Send, Upload } from "lucide-react";
import type { Tables, TablesUpdate } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { buildBackupCsv, buildInReviewCsv } from "@/lib/inventory/csv";
import { COUNTIES, JURISDICTIONS, NOC_STATUSES, STAGES, SUB_STATUSES, canonicalJurisdiction, compactCurrency, countyOf, currency, isFlagged, isReview30Plus, isSubmit5Plus, stageWhenOrdered } from "@/lib/inventory/constants";
import { useTechSlots } from "@/components/tech-slots-provider";
import { displayNameOnly, type TechNameMap } from "@/lib/tech-labels";
import { normalizeTradeFamily } from "@/lib/jobs/trade";
import { AgingView } from "./aging-view";
import { BoardView } from "./board-view";
import { CsvUploadForm } from "./csv-upload-form";
import { FeeReceiptsReportButton } from "./fee-receipts-report-button";
import { PropertyAppraiserButton } from "./property-appraiser-button";
import { JobRow, JOB_ROW_GRID } from "./job-row";
import { NewJobForm } from "./new-job-form";
import { BulkJobForm } from "./bulk-job-form";
import { ActivityReport, CycleTimeReport, PerformanceReport, PrintReport, ToDoReport } from "./reports";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BoardSkeleton } from "@/components/ui/loading-skeletons";
import { jobStatusFill } from "@/lib/ui/fills";
type Job = Tables<"jobs">;
type JobFile = Tables<"job_files">;
type ReportType = "jobs" | "cycle" | "daily" | "weekly" | "monthly" | "custom" | "performance" | "todo" | "roofing";
type TradeFilter = "All" | "windows" | "roofing";

export function InventoryBoard({
  orgId,
  orgName,
  userId,
  initialReport,
}: {
  orgId: string;
  orgName: string;
  userId: string;
  initialReport?: string;
}) {
  const { permitTechs: PERMIT_TECHS } = useTechSlots();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [activeTech, setActiveTech] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [permitStatusFilter, setPermitStatusFilter] = useState("All");
  const [nocFilter, setNocFilter] = useState("All");
  const [flaggedFilter, setFlaggedFilter] = useState("All");
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>("All");
  const [countyFilter, setCountyFilter] = useState("All");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("All");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "board" | "aging">("list");
  const [reportType, setReportType] = useState<ReportType>(
    initialReport === "cycle" ||
      initialReport === "daily" ||
      initialReport === "weekly" ||
    initialReport === "custom" ||
      initialReport === "monthly" ||
      initialReport === "performance" ||
      initialReport === "todo" ||
      initialReport === "roofing" ||
      initialReport === "jobs"
      ? initialReport
      : "jobs",
  );
  const [techNames, setTechNames] = useState<TechNameMap>({});
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("jobs").select("*").eq("org_id", orgId).order("updated_at", { ascending: false });
    setJobs(data ?? []);
    setLoading(false);
  }, [orgId]);
  const loadFiles = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("job_files").select("*").eq("org_id", orgId).order("uploaded_at", { ascending: false });
    setFiles(data ?? []);
  }, [orgId]);
  useEffect(() => { void loadJobs(); void loadFiles(); }, [loadFiles, loadJobs]);
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("org_tech_names")
      .select("slot, display_name")
      .eq("org_id", orgId)
      .eq("kind", "permit")
      .then(({ data }) => {
        if (!data) return;
        const map: TechNameMap = {};
        for (const row of data) map[row.slot] = row.display_name;
        setTechNames(map);
      });
  }, [orgId]);

  const jurisdictionOptions = useMemo(() => {
    const byLower = new Map<string, string>();
    for (const jurisdiction of JURISDICTIONS) byLower.set(jurisdiction.toLowerCase(), jurisdiction);
    for (const job of jobs) {
      const value = (job.jurisdiction ?? "").trim();
      if (value && !byLower.has(value.toLowerCase())) byLower.set(value.toLowerCase(), value);
    }
    return Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  }, [jobs]);
  const filesByJob = useMemo(() => files.reduce<Record<string, JobFile[]>>((map, file) => {
    (map[file.job_id] ??= []).push(file);
    return map;
  }, {}), [files]);
  const hasSearch = query.trim().length > 0;
  const isNarrowed = hasSearch || stageFilter !== "All" || permitStatusFilter !== "All" || nocFilter !== "All" || flaggedFilter !== "All" || activeTech !== "All" || tradeFilter !== "All" || countyFilter !== "All" || jurisdictionFilter !== "All";
  const jurisdictionFilterOptions = useMemo(() => {
    if (countyFilter === "All") return JURISDICTIONS;
    return JURISDICTIONS.filter((jurisdiction) => countyOf(jurisdiction) === countyFilter);
  }, [countyFilter]);
  const filtered = useMemo(() => {
    let list = jobs;
    if (activeTech !== "All") list = list.filter((job) => job.permit_tech === activeTech);
    if (tradeFilter !== "All") list = list.filter((job) => normalizeTradeFamily(job.trade_type) === tradeFilter);
    if (countyFilter !== "All") list = list.filter((job) => countyOf(job.jurisdiction) === countyFilter);
    if (jurisdictionFilter !== "All") list = list.filter((job) => canonicalJurisdiction(job.jurisdiction) === jurisdictionFilter);
    if (stageFilter !== "All") list = list.filter((job) => job.stage === stageFilter);
    if (permitStatusFilter !== "All") list = list.filter((job) => job.sub_status === permitStatusFilter);
    if (nocFilter !== "All") list = list.filter((job) => job.noc_status === nocFilter);
    if (flaggedFilter === "review30") list = list.filter(isReview30Plus);
    if (flaggedFilter === "submit5") list = list.filter(isSubmit5Plus);
    if (flaggedFilter === "any") list = list.filter(isFlagged);
    if (!hasSearch) {
      if (permitStatusFilter !== "Complete") list = list.filter((job) => job.sub_status !== "Complete");
      return list;
    }
    const q = query.trim().toLowerCase();
    return list.filter((job) => job.client_name.toLowerCase().includes(q) || job.job_number.toLowerCase().includes(q) || (job.permit_number ?? "").toLowerCase().includes(q) || (job.jurisdiction ?? "").toLowerCase().includes(q));
  }, [jobs, activeTech, tradeFilter, countyFilter, jurisdictionFilter, flaggedFilter, hasSearch, nocFilter, permitStatusFilter, query, stageFilter]);
  const techCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(PERMIT_TECHS.map((tech) => [tech, 0]));
    for (const job of jobs) counts[job.permit_tech] = (counts[job.permit_tech] ?? 0) + 1;
    return counts;
  }, [jobs, PERMIT_TECHS]);
  const statsScope = useMemo(() => activeTech === "All" ? jobs : jobs.filter((job) => job.permit_tech === activeTech), [activeTech, jobs]);
  const stats = useMemo(() => {
    const bySubStatus = Object.fromEntries(SUB_STATUSES.map((s) => [s, 0])) as Record<(typeof SUB_STATUSES)[number], number>;
    for (const job of statsScope) if (job.sub_status in bySubStatus) bySubStatus[job.sub_status as keyof typeof bySubStatus]++;
    return {
      totalJobs: statsScope.filter((job) => job.sub_status !== "Complete").length,
      backlogValue: statsScope
        .filter((job) => job.sub_status !== "Complete" && job.sub_status !== "Approved and Printed")
        .reduce((sum, job) => sum + (job.contract_value ?? 0), 0),
      bySubStatus,
      review30: statsScope.filter(isReview30Plus).length,
      submit5: statsScope.filter(isSubmit5Plus).length,
    };
  }, [statsScope]);
  const byStage = useMemo(() => stageMap(filtered), [filtered]);
  const printByStage = useMemo(() => stageMap(isNarrowed ? filtered : jobs), [filtered, isNarrowed, jobs]);
  const roofingByStage = useMemo(
    () => stageMap((isNarrowed ? filtered : jobs).filter((job) => normalizeTradeFamily(job.trade_type) === "roofing")),
    [filtered, isNarrowed, jobs],
  );

  async function updateJob(id: string, patch: TablesUpdate<"jobs">, force = false) {
    const current = jobs.find((job) => job.id === id);
    let realChanges = patch;
    if (!force) {
      realChanges = {};
      for (const [key, next] of Object.entries(patch)) {
        const before = current ? (current as Record<string, unknown>)[key] : undefined;
        if ((next ?? null) !== (before ?? null)) (realChanges as Record<string, unknown>)[key] = next;
      }
      if (!Object.keys(realChanges).length) return;
    }
    if (realChanges.sub_status && current) {
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (realChanges.sub_status === "In Review" && !current.submitted_date && realChanges.submitted_date === undefined) realChanges.submitted_date = todayIso;
      if ((realChanges.sub_status === "Approved" || realChanges.sub_status === "Approved and Printed") && !current.approved_date && realChanges.approved_date === undefined) realChanges.approved_date = todayIso;
    }
    if (realChanges.ordered_date && current && realChanges.stage === undefined) {
      const nextStage = stageWhenOrdered(current.stage);
      if (nextStage !== current.stage) realChanges.stage = nextStage;
    }
    setJobs((previous) => previous.map((job) => job.id === id ? { ...job, ...realChanges } : job));
    const supabase = createClient();
    const { error } = await supabase.from("jobs").update(realChanges).eq("id", id).eq("org_id", orgId);
    if (error) {
      setJobs((previous) => previous.map((job) => job.id === id && current ? current : job));
      alert(`Couldn't save that change: ${error.message}`);
    }
  }
  async function deleteJob(id: string) {
    const previous = jobs;
    setJobs((all) => all.filter((job) => job.id !== id));
    const supabase = createClient();
    const { error } = await supabase.from("jobs").delete().eq("id", id).eq("org_id", orgId);
    if (error) { setJobs(previous); alert(`Couldn't delete that job: ${error.message}`); }
  }
  async function uploadJobFile(jobId: string, file: File) {
    const supabase = createClient(), safeName = file.name.replace(/[^\w.\-]/g, "_"), path = `${jobId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
    if (uploadError) return alert(`Couldn't upload that file: ${uploadError.message}`);
    const { error: insertError } = await supabase.from("job_files").insert({ org_id: orgId, job_id: jobId, file_name: file.name, storage_path: path, size_bytes: file.size, uploaded_by: userId, category: "permit-inventory" });
    if (insertError) { await supabase.storage.from("job-files").remove([path]); return alert(`Couldn't save that file: ${insertError.message}`); }
    await loadFiles();
  }
  async function downloadJobFile(file: JobFile) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("job-files").createSignedUrl(file.storage_path, 60);
    if (error || !data) return alert(`Couldn't open that file: ${error?.message ?? "unknown error"}`);
    window.open(data.signedUrl, "_blank");
  }
  async function deleteJobFile(file: JobFile) {
    const supabase = createClient();
    const { error } = await supabase.from("job_files").delete().eq("id", file.id).eq("org_id", orgId);
    if (error) return alert(`Couldn't remove that file: ${error.message}`);
    await supabase.storage.from("job-files").remove([file.storage_path]);
    await loadFiles();
  }
  function openJob(job: Job) {
    setViewMode("list");
    setCollapsed((previous) => { const next = new Set(previous); next.delete(job.stage); return next; });
    setTimeout(() => document.getElementById(`stage-${job.stage.replace(/[^a-zA-Z0-9]/g, "-")}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }
  function resetFilters() { setActiveTech("All"); setTradeFilter("All"); setCountyFilter("All"); setJurisdictionFilter("All"); setStageFilter("All"); setPermitStatusFilter("All"); setNocFilter("All"); setFlaggedFilter("All"); setQuery(""); }
  function filterByPermitStatus(status: string) { setStageFilter("All"); setPermitStatusFilter(status); setNocFilter("All"); setFlaggedFilter("All"); setQuery(""); }
  function filterByFlag(flag: string) { setStageFilter("All"); setPermitStatusFilter("All"); setNocFilter("All"); setFlaggedFilter(flag); setQuery(""); }
  function download(content: string, filename: string) { const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }

  const selectClass = "h-8 min-w-[9rem] rounded-full";
  const REPORTS: [ReportType, string][] = [
    ["jobs", "Job list"],
    ["daily", "Daily activity"],
    ["weekly", "Weekly activity"],
    ["monthly", "Monthly activity"],
    ["custom", "Custom range activity"],
    ["cycle", "Cycle times"],
    ["todo", "To-do list"],
    ["performance", "My performance"],
    ["roofing", "Roofing only"],
  ];
  return <>
    <div className="space-y-3 print:hidden">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">{orgName}</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Permit Inventory</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">As of {dateLabel()}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="h-10 rounded-full pl-8" placeholder="Client, job #, permit #" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <Button onClick={() => setShowNew(true)}><Plus /> Add job</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setShowBulk(true)}><Plus /> Add 10 jobs</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowUpload(true)}><Upload /> Upload spreadsheet</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => download(buildBackupCsv(jobs), `permit-inventory-backup-${new Date().toISOString().slice(0, 10)}.csv`)}><Download /> Download backup</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const scoped = activeTech === "All" ? jobs : jobs.filter((j) => j.permit_tech === activeTech);
                const suffix = activeTech === "All" ? "" : `-${displayNameOnly(activeTech, techNames).replace(/[^\w-]+/g, "-")}`;
                download(buildInReviewCsv(scoped), `permits-in-review${suffix}-${new Date().toISOString().slice(0, 10)}.csv`);
              }}><FolderDown /> In-review list</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Reports</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {REPORTS.map(([value, label]) => (
                    <DropdownMenuItem key={value} onClick={() => setReportType(value)}>
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => window.print()}><Printer /> Print report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard label="Total Jobs" value={stats.totalJobs} icon={Briefcase} tone="primary" onClick={resetFilters} />
        <KpiCard label="Backlog Value" value={compactCurrency(stats.backlogValue)} title={currency(stats.backlogValue)} icon={DollarSign} tone="primary" onClick={resetFilters} />
        <KpiCard label="Need to Submit" value={stats.bySubStatus["Need to Submit"]} icon={Send} tone="accent" active={permitStatusFilter === "Need to Submit"} onClick={() => filterByPermitStatus("Need to Submit")} />
        <KpiCard label="Quote Needed" value={stats.bySubStatus["Quote Needed"]} icon={DollarSign} tone="warn" active={permitStatusFilter === "Quote Needed"} onClick={() => filterByPermitStatus("Quote Needed")} />
        <KpiCard label="Engineering Pending" value={stats.bySubStatus["Engineering Pending"]} icon={Clock} tone="warn" active={permitStatusFilter === "Engineering Pending"} onClick={() => filterByPermitStatus("Engineering Pending")} />
        <KpiCard label="In Review" value={stats.bySubStatus["In Review"]} icon={FileCheck2} tone="info" active={permitStatusFilter === "In Review"} onClick={() => filterByPermitStatus("In Review")} />
        <KpiCard label="Corrections Needed" value={stats.bySubStatus["Corrections Needed"]} icon={AlertTriangle} tone="danger" active={permitStatusFilter === "Corrections Needed"} onClick={() => filterByPermitStatus("Corrections Needed")} />
        <KpiCard label="Approved" value={stats.bySubStatus.Approved} icon={CheckCircle2} tone="good" active={permitStatusFilter === "Approved"} onClick={() => filterByPermitStatus("Approved")} />
        <KpiCard label="Approved and Printed" value={stats.bySubStatus["Approved and Printed"]} icon={Printer} tone="good" active={permitStatusFilter === "Approved and Printed"} onClick={() => filterByPermitStatus("Approved and Printed")} />
        <KpiCard label="Archive" value={stats.bySubStatus.Complete} icon={CheckCheck} tone="primary" active={permitStatusFilter === "Complete"} onClick={() => filterByPermitStatus("Complete")} />
        <KpiCard label="Review 30+" value={stats.review30} icon={Clock} tone="danger" active={flaggedFilter === "review30"} onClick={() => filterByFlag("review30")} />
        <KpiCard label="Submit 5+" value={stats.submit5} icon={AlertTriangle} tone="danger" active={flaggedFilter === "submit5"} onClick={() => filterByFlag("submit5")} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterButton active={activeTech === "All"} onClick={() => setActiveTech("All")}>All ({jobs.length})</FilterButton>
        {PERMIT_TECHS.map((tech) => <FilterButton key={tech} active={activeTech === tech} onClick={() => setActiveTech(tech)}>{displayNameOnly(tech, techNames)} ({techCounts[tech] ?? 0})</FilterButton>)}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={tradeFilter} onValueChange={(value) => setTradeFilter(value as TradeFilter)}><SelectTrigger className={selectClass}><SelectValue placeholder="All trades" /></SelectTrigger><SelectContent><SelectItem value="All">All trades</SelectItem><SelectItem value="windows">Windows only</SelectItem><SelectItem value="roofing">Roofing only</SelectItem></SelectContent></Select>
        <Select value={countyFilter} onValueChange={(value) => { setCountyFilter(value); if (jurisdictionFilter !== "All" && countyOf(jurisdictionFilter) !== value) setJurisdictionFilter("All"); }}><SelectTrigger className={selectClass}><SelectValue placeholder="All counties" /></SelectTrigger><SelectContent><SelectItem value="All">All counties</SelectItem>{COUNTIES.map((county) => <SelectItem key={county} value={county}>{county}</SelectItem>)}</SelectContent></Select>
        <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}><SelectTrigger className={selectClass}><SelectValue placeholder="Building department" /></SelectTrigger><SelectContent><SelectItem value="All">All building departments</SelectItem>{jurisdictionFilterOptions.map((jurisdiction) => <SelectItem key={jurisdiction} value={jurisdiction}>{jurisdiction}</SelectItem>)}</SelectContent></Select>
        <Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger className={selectClass}><SelectValue placeholder="All job statuses" /></SelectTrigger><SelectContent><SelectItem value="All">All job statuses</SelectItem>{STAGES.map((stage)=><SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select>
        <Select value={permitStatusFilter} onValueChange={setPermitStatusFilter}><SelectTrigger className={selectClass}><SelectValue placeholder="All permit statuses" /></SelectTrigger><SelectContent><SelectItem value="All">All permit statuses</SelectItem>{SUB_STATUSES.map((status)=><SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
        <Select value={nocFilter} onValueChange={setNocFilter}><SelectTrigger className={selectClass}><SelectValue placeholder="Any NOC status" /></SelectTrigger><SelectContent><SelectItem value="All">Any NOC status</SelectItem>{NOC_STATUSES.map((status)=><SelectItem key={status} value={status}>NOC: {status}</SelectItem>)}</SelectContent></Select>
        <Select value={flaggedFilter} onValueChange={setFlaggedFilter}><SelectTrigger className={selectClass}><SelectValue placeholder="All jobs" /></SelectTrigger><SelectContent><SelectItem value="All">All jobs</SelectItem><SelectItem value="review30">In review 30+ days</SelectItem><SelectItem value="submit5">Need to submit, assigned 5+ days</SelectItem><SelectItem value="any">Any flagged job</SelectItem></SelectContent></Select>
        <Select value="" onValueChange={(stage) => { if (!stage) return; setCollapsed((previous) => { const next = new Set(previous); next.delete(stage); return next; }); setTimeout(() => document.getElementById(`stage-${stage.replace(/[^a-zA-Z0-9]/g, "-")}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}><SelectTrigger className={selectClass}><SelectValue placeholder="Jump to status…" /></SelectTrigger><SelectContent>{STAGES.map((stage)=><SelectItem key={stage} value={stage}>{stage} ({(byStage[stage] ?? []).length})</SelectItem>)}</SelectContent></Select>
        <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
        <Button variant={viewMode === "list" ? "secondary" : "outline"} size="sm" onClick={() => setViewMode("list")}>List</Button>
        <Button variant={viewMode === "board" ? "secondary" : "outline"} size="sm" onClick={() => setViewMode("board")}>Pipeline</Button>
        <Button variant={viewMode === "aging" ? "secondary" : "outline"} size="sm" onClick={() => setViewMode("aging")}>Aging</Button>
        <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>Expand all</Button>
        <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set(STAGES))}>Collapse all</Button>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <FeeReceiptsReportButton orgId={orgId} orgName={orgName} techNames={techNames} />
          <PropertyAppraiserButton />
        </span>
      </div>
          {reportType === "custom" && (
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="report-from" className="text-xs font-medium text-muted-foreground">From</label>
        <Input id="report-from" type="date" className="h-8 w-40 rounded-full" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
        <label htmlFor="report-to" className="text-xs font-medium text-muted-foreground">To</label>
        <Input id="report-to" type="date" className="h-8 w-40 rounded-full" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
      </div>
    )}
          <p className="text-xs text-muted-foreground">
            {permitStatusFilter === "Complete"
        ? `${filtered.length} archived (complete) · still on the job for later stages`          : <>{filtered.length} jobs{stats.bySubStatus.Complete > 0 && !hasSearch ? <> · {stats.bySubStatus.Complete} complete in archive</> : null}</>}
      </p>
    </div>
    <NewJobForm open={showNew} onOpenChange={setShowNew} orgId={orgId} userId={userId} jurisdictionOptions={jurisdictionOptions} onCreated={(job) => setJobs((previous) => [job, ...previous])} />
    <BulkJobForm open={showBulk} onOpenChange={setShowBulk} orgId={orgId} userId={userId} onCreated={(newJobs) => setJobs((previous) => [...newJobs, ...previous])} />
    <CsvUploadForm open={showUpload} onOpenChange={setShowUpload} orgId={orgId} userId={userId} onUploaded={loadJobs} />
    <div className="print:hidden">
      {loading ? <BoardSkeleton stages={5} /> : viewMode === "board" ? <BoardView jobs={filtered} onOpen={openJob} /> : viewMode === "aging" ? <AgingView jobs={filtered} onOpen={openJob} /> : <div className="space-y-4">
        {STAGES.filter((stage) => !isNarrowed || (byStage[stage] ?? []).length > 0).map((stage) => {
          const stageJobs = byStage[stage] ?? [], isCollapsed = collapsed.has(stage);
          return <div key={stage} id={`stage-${stage.replace(/[^a-zA-Z0-9]/g, "-")}`} className="scroll-mt-4">
            <button onClick={() => setCollapsed((previous) => { const next = new Set(previous); if (next.has(stage)) next.delete(stage); else next.add(stage); return next; })} className="flex w-full items-center gap-2 px-2 py-1.5 text-left">
              {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className={`flex flex-1 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-bold shadow-sm sm:text-base ${jobStatusFill(stage)}`}>
                {stage}
                <span className="ml-2 tabular-nums font-bold opacity-90">({stageJobs.length})</span>
              </span>
              <span className="shrink-0 text-base font-semibold text-primary">{currency(stageJobs.reduce((sum, job) => sum + (job.contract_value ?? 0), 0))}</span>
            </button>
            {!isCollapsed && <div className="space-y-0.5">
              <div className={`${JOB_ROW_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
                <span /><span />
                <span>Job #</span>
                <span>Contract</span>
                <span>Client</span>
                <span>City</span>
                <span className="text-center">Permit #</span>
                <span>Status</span>
                <span className="text-center">Asgn</span>
                <span className="text-center">Sub</span>
                <span className="text-center">Appr</span>
                <span className="text-center">Ord</span>
                <span className="text-center">ETA</span>
                <span />
              </div>
              {stageJobs.map((job) => <JobRow key={job.id} job={job} onUpdate={(patch, force) => updateJob(job.id, patch, force)} onDelete={() => deleteJob(job.id)} jurisdictionOptions={jurisdictionOptions} files={filesByJob[job.id] ?? []} onUploadFile={(file) => uploadJobFile(job.id, file)} onDownloadFile={downloadJobFile} onDeleteFile={deleteJobFile} techNames={techNames} />)}{stageJobs.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No jobs</p>}</div>}
          </div>;
        })}
      </div>}
    </div>
    {reportType === "todo" ? <ToDoReport jobs={statsScope} who={activeTech === "All" ? "All permit techs" : activeTech} orgName={orgName} /> : reportType === "performance" ? <PerformanceReport jobs={statsScope} who={activeTech === "All" ? "All permit techs" : activeTech} orgName={orgName} /> : reportType === "cycle" ? <CycleTimeReport jobs={statsScope} orgName={orgName} /> : reportType === "daily" || reportType === "weekly" || reportType === "monthly" || reportType === "custom" ? <ActivityReport jobs={statsScope} period={reportType === "daily" ? "day" : reportType === "weekly" ? "week" : reportType === "monthly" ? "month" : "custom"} customStart={customFrom || undefined} customEnd={customTo || undefined} orgName={orgName} who={activeTech === "All" ? "All permit techs" : activeTech} /> : reportType === "roofing" ? <PrintReport byStage={roofingByStage} scope={["Roofing jobs only", isNarrowed ? [stageFilter !== "All" ? `Job status: ${stageFilter}` : null, permitStatusFilter !== "All" ? `Permit status: ${permitStatusFilter}` : null, nocFilter !== "All" ? `NOC: ${nocFilter}` : null, flaggedFilter !== "All" ? `Flagged: ${flaggedFilter}` : null, activeTech !== "All" ? activeTech : null, query.trim() ? `Search: "${query.trim()}"` : null].filter(Boolean).join(" · ") : null].filter(Boolean).join(" · ")} orgName={orgName} /> : <PrintReport byStage={printByStage} scope={isNarrowed ? [tradeFilter !== "All" ? `Trade: ${tradeFilter}` : null, stageFilter !== "All" ? `Job status: ${stageFilter}` : null, permitStatusFilter !== "All" ? `Permit status: ${permitStatusFilter}` : null, nocFilter !== "All" ? `NOC: ${nocFilter}` : null, flaggedFilter !== "All" ? `Flagged: ${flaggedFilter}` : null, activeTech !== "All" ? activeTech : null, query.trim() ? `Search: "${query.trim()}"` : null].filter(Boolean).join(" · ") : "All jobs"} orgName={orgName} />}
  </>;
}

function stageMap(jobs: Job[]) { const map: Record<string, Job[]> = {}; for (const stage of STAGES) map[stage] = []; for (const job of jobs) (map[job.stage] ??= []).push(job); return map; }
function dateLabel() { return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "ghost"}
      className="h-8 rounded-full px-3"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
