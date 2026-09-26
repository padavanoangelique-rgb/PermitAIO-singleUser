"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  DollarSign,
  LayoutGrid,
  ListChecks,
  Map as MapIcon,
  Search,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { currency } from "@/lib/inventory/constants";
import { FILL_AMBER, FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { KpiCard, type KpiTone } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
import {
  addInstallMember,
  addJobToInstallBoard,
  assignAccountManager,
  assignInstallJob,
  checkInstallJob,
  checkoutInstallPermit,
  scheduleInstallJob,
  updateInstallPayment,
} from "./actions";
import { InstallMap } from "./install-map";
import { BOARD_GRID, BTN_BLUE, BTN_GREEN, BTN_PURPLE, CELL, FIELD, JOB_CHIP, PILL, ROW, TRACK, TRACKER_GRID } from "./install-ui";
import { InstallJobDetail } from "./install-job-detail";

export type InstallMember = {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
  display_name?: string | null;
  company_name?: string | null;
};
export type InstallAssignment = {
  job_id: string;
  job_number: string;
  installer_id: string | null;
  pm_id: string | null;
  account_manager_id?: string | null;
  inspection_status?: string | null;
  inspection_result?: string | null;
  inspection_date?: string | null;
  pm_checked_at?: string | null;
  pm_checked_by?: string | null;
  permit_checked_out_at?: string | null;
  permit_checked_out_by?: string | null;
  scheduled_date?: string | null;
  deposit_collected?: boolean | null;
  deposit_amount?: number | null;
  deposit_date?: string | null;
  change_order?: boolean | null;
  contract_signed?: boolean | null;
  final_payment_collected?: boolean | null;
  final_payment_amount?: number | null;
  final_payment_date?: string | null;
};
export type InstallJob = {
  id: string;
  job_number: string;
  client_name: string;
  address: string | null;
  city: string | null;
  trade_type: string | null;
  permit_number: string | null;
  contract_value: number | null;
};

type Lane = "need_schedule" | "need_am" | "need_crew" | "scheduled" | "need_check" | "passed" | "failed";
type Filter = Lane | "on_board" | null;
type Tab = "overview" | "board" | "map";

const LANES: { key: Lane; label: string }[] = [
  { key: "need_schedule", label: "Need to be scheduled" },
  { key: "need_am", label: "Need account manager" },
  { key: "need_crew", label: "Need crew" },
  { key: "scheduled", label: "Inspection scheduled" },
  { key: "need_check", label: "Need PM check" },
  { key: "passed", label: "Passed" },
  { key: "failed", label: "Failed" },
];

const LANE_SHORT: Record<Lane, string> = {
  need_schedule: "To schedule",
  need_am: "Need AM",
  need_crew: "Need crew",
  scheduled: "Scheduled",
  need_check: "PM check",
  passed: "Passed",
  failed: "Failed",
};

const LANE_TONE: Record<Lane, string> = {
  need_schedule: FILL_PURPLE,
  need_am: FILL_AMBER,
  need_crew: FILL_BLUE,
  scheduled: FILL_GREEN,
  need_check: FILL_AMBER,
  passed: FILL_GREEN,
  failed: "bg-red-600 text-white",
};

const ROLE_ORDER = ["install_manager", "account_manager", "project_manager", "installer"] as const;
const ROLE_LABEL: Record<string, string> = {
  install_manager: "Install manager",
  account_manager: "Account manager",
  project_manager: "Project manager",
  installer: "Installer",
};
const ROLE_GROUP: Record<string, string> = {
  install_manager: "Install managers",
  account_manager: "Account managers",
  project_manager: "Project managers",
  installer: "Installers",
};
const CREW_CHIP =
  "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold";

const SELECT = FIELD;

function memberLabel(m?: InstallMember) {
  if (!m) return "Unassigned";
  const name = m.display_name?.trim();
  const company = m.company_name?.trim();
  if (name && company) return `${name} · ${company}`;
  return name || company || m.email;
}

function personName(m?: InstallMember) {
  if (!m) return "Unassigned";
  return m.display_name?.trim() || m.email.split("@")[0] || m.email;
}

function CrewName({ m }: { m?: InstallMember }) {
  return m ? (
    <span className="min-w-0 truncate text-sm">{personName(m)}</span>
  ) : (
    <span className="text-sm text-muted-foreground">—</span>
  );
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HUG_NAME = `inline-flex h-9 w-[13rem] min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_PURPLE}`;
const SCHEDULE_BTN = `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_GREEN}`;
const DATE_INPUT = "h-8 w-[8.5rem] rounded-full border border-border bg-background px-3 text-sm";

function crewLane(a?: InstallAssignment): "scheduled" | "inProgress" | "final" | "other" {
  if (!a) return "other";
  if (a.inspection_date || a.inspection_status === "scheduled") return "final";
  if (a.permit_checked_out_at || a.pm_checked_at) return "inProgress";
  if (a.scheduled_date) return "scheduled";
  return "other";
}

function crewStats(
  role: string,
  memberId: string,
  jobs: InstallJob[],
  assignmentByJob: Map<string, InstallAssignment>,
) {
  const mine = jobs.filter((job) => {
    const a = assignmentByJob.get(job.id);
    if (role === "install_manager") return true;
    if (role === "account_manager") return a?.account_manager_id === memberId;
    if (role === "project_manager") return a?.pm_id === memberId;
    if (role === "installer") return a?.installer_id === memberId;
    return false;
  });
  let scheduled = 0;
  let inProgress = 0;
  let pendingFinal = 0;
  for (const job of mine) {
    const lane = crewLane(assignmentByJob.get(job.id));
    if (lane === "scheduled") scheduled += 1;
    else if (lane === "inProgress") inProgress += 1;
    else if (lane === "final") pendingFinal += 1;
  }
  return { total: mine.length, scheduled, inProgress, pendingFinal };
}

function formatStamp(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function inspectionLabel(date?: string | null) {
  if (!date) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toISOString().slice(0, 10);
}

function MoneyRow({
  label,
  checkedName,
  checked,
  amountName,
  amount,
  dateName,
  date,
}: {
  label: string;
  checkedName: string;
  checked: boolean;
  amountName?: string;
  amount?: number | null;
  dateName?: string;
  date?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl px-1 py-1.5">
      <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm font-medium">
        <input type="checkbox" name={checkedName} defaultChecked={checked} className="h-4 w-4 rounded border-input" />
        {label}
      </label>
      {amountName ? (
        <label className="text-xs text-muted-foreground">
          Amount
          <input
            type="number"
            step="0.01"
            name={amountName}
            defaultValue={amount ?? ""}
            placeholder="$"
            className="mt-1 block h-9 w-28 rounded-full border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
      ) : null}
      {dateName ? (
        <label className="text-xs text-muted-foreground">
          Date
          <input
            type="date"
            name={dateName}
            defaultValue={date ?? ""}
            className="mt-1 block h-9 rounded-full border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
      ) : null}
    </div>
  );
}

/** The Install Manager's payment checklist for one job — deposit, change
 * order, signed contract, final payment. Lives on the same job_id row
 * (install_job_assignments) as everything else on this card, so it shows
 * up right where the Install Manager already clicks to see a job's
 * details rather than needing a separate page. */
function MoneySection({ job, assignment }: { job: InstallJob; assignment?: InstallAssignment }) {
  return (
    <section className="space-y-2 px-1 py-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Money</h3>
      <form action={updateInstallPayment} className="space-y-2">
        <input type="hidden" name="jobId" value={job.id} />
        <input type="hidden" name="jobNumber" value={job.job_number} />
        <MoneyRow
          label="Deposit collected"
          checkedName="depositCollected"
          checked={!!assignment?.deposit_collected}
          amountName="depositAmount"
          amount={assignment?.deposit_amount}
          dateName="depositDate"
          date={assignment?.deposit_date}
        />
        <MoneyRow label="Change order" checkedName="changeOrder" checked={!!assignment?.change_order} />
        <MoneyRow label="Contract signed" checkedName="contractSigned" checked={!!assignment?.contract_signed} />
        <MoneyRow
          label="Final payment collected"
          checkedName="finalPaymentCollected"
          checked={!!assignment?.final_payment_collected}
          amountName="finalPaymentAmount"
          amount={assignment?.final_payment_amount}
          dateName="finalPaymentDate"
          date={assignment?.final_payment_date}
        />
        <button type="submit" className={BTN_BLUE}>
          Save money
        </button>
      </form>
    </section>
  );
}

function laneOf(jobId: string, a: InstallAssignment | undefined, readyIds: Set<string>): Lane {
  if (a?.inspection_result === "failed") return "failed";
  if (a?.inspection_result === "passed") return "passed";
  if (readyIds.has(jobId) && !a?.installer_id && !a?.inspection_date && !a?.scheduled_date) return "need_schedule";
  if (!a?.account_manager_id) return "need_am";
  if (!a.installer_id || !a.pm_id) return "need_crew";
  if (a.inspection_date || a.inspection_status === "scheduled") return "scheduled";
  return "need_check";
}

export function InstallDashboard({
  jobs,
  assignments,
  members,
  addable,
  mail,
  tableNote,
  myTitle,
  signedInName,
  orgName,
  showMoney,
  canManage,
  canCheck,
  warehouseReadyIds,
  orgId,
  photoCountByJob,
  permitOnFileIds,
}: {
  jobs: InstallJob[];
  assignments: InstallAssignment[];
  members: InstallMember[];
  addable: InstallJob[];
  mail?: string;
  tableNote?: string;
  myTitle: string;
  signedInName: string;
  orgName: string;
  showMoney: boolean;
  canManage: boolean;
  canCheck: boolean;
  warehouseReadyIds: string[];
  orgId: string;
  photoCountByJob: Record<string, number>;
  permitOnFileIds: string[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>(null);
  const [query, setQuery] = useState("");
  const [crewId, setCrewId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const readyIds = useMemo(() => new Set(warehouseReadyIds), [warehouseReadyIds]);
  const permitOnFile = useMemo(() => new Set(permitOnFileIds), [permitOnFileIds]);

  const assignmentByJob = useMemo(() => new Map(assignments.map((a) => [a.job_id, a])), [assignments]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const accountManagers = members.filter((m) => m.role === "account_manager");
  const pms = members.filter((m) => m.role === "project_manager");
  const installers = members.filter((m) => m.role === "installer");

  const roster = useMemo(() => {
    const list = [...members];
    if (!list.some((m) => m.role === "install_manager") && canManage) {
      list.unshift({
        id: "self-manager",
        email: signedInName,
        role: "install_manager",
        user_id: null,
        display_name: signedInName.includes("@") ? signedInName.split("@")[0] : signedInName,
        company_name: orgName,
      });
    }
    return list;
  }, [members, canManage, signedInName, orgName]);

  const crewFocus = crewId ? roster.find((m) => m.id === crewId) : undefined;

  const crewJobs = useMemo(() => {
    let list = jobs;
    if (crewFocus) {
      list = list.filter((job) => {
        const a = assignmentByJob.get(job.id);
        if (crewFocus.role === "account_manager") return a?.account_manager_id === crewFocus.id;
        if (crewFocus.role === "project_manager") return a?.pm_id === crewFocus.id;
        if (crewFocus.role === "installer") return a?.installer_id === crewFocus.id;
        return true;
      });
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (job) =>
          job.job_number.toLowerCase().includes(q) ||
          job.client_name.toLowerCase().includes(q) ||
          (job.address ?? "").toLowerCase().includes(q) ||
          (job.city ?? "").toLowerCase().includes(q) ||
          (job.permit_number ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [jobs, crewFocus, query, assignmentByJob]);

  const boardJobs = useMemo(() => {
    if (filter && filter !== "on_board") {
      return crewJobs.filter((job) => laneOf(job.id, assignmentByJob.get(job.id), readyIds) === filter);
    }
    return crewJobs;
  }, [crewJobs, filter, assignmentByJob, readyIds]);

  const counts = useMemo(() => {
    const byLane: Record<Lane, number> = {
      need_schedule: 0,
      need_am: 0,
      need_crew: 0,
      scheduled: 0,
      need_check: 0,
      passed: 0,
      failed: 0,
    };
    let money = 0;
    for (const job of jobs) {
      const a = assignmentByJob.get(job.id);
      byLane[laneOf(job.id, a, readyIds)] += 1;
      money += job.contract_value ?? 0;
    }
    return { ...byLane, on_board: jobs.length, money };
  }, [jobs, assignmentByJob, readyIds]);

  const kpis: { key: Filter; label: string; value: string | number; icon: typeof Briefcase; tone: KpiTone }[] = [
    { key: "on_board", label: "On board", value: counts.on_board, icon: Briefcase, tone: "neutral" },
    { key: "need_schedule", label: "To schedule", value: counts.need_schedule, icon: ListChecks, tone: "warn" },
    { key: "need_am", label: "Need AM", value: counts.need_am, icon: UserPlus, tone: "warn" },
    { key: "need_crew", label: "Need crew", value: counts.need_crew, icon: Users, tone: "info" },
    { key: "scheduled", label: "Scheduled", value: counts.scheduled, icon: CalendarClock, tone: "accent" },
    { key: "need_check", label: "PM check", value: counts.need_check, icon: CircleAlert, tone: "warn" },
    { key: "passed", label: "Passed", value: counts.passed, icon: CheckCircle2, tone: "good" },
    { key: "failed", label: "Failed", value: counts.failed, icon: XCircle, tone: "danger" },
  ];
  if (showMoney) {
    kpis.push({
      key: null,
      label: "Money out",
      value: currency(counts.money),
      icon: DollarSign,
      tone: "primary",
    });
  }

  const moneyBy = (role: string) =>
    members
      .filter((m) => m.role === role)
      .map((m) => {
        const ids = new Set(
          assignments
            .filter((a) =>
              role === "account_manager"
                ? a.account_manager_id === m.id
                : role === "project_manager"
                  ? a.pm_id === m.id
                  : a.installer_id === m.id,
            )
            .map((a) => a.job_id),
        );
        const value = jobs.filter((j) => ids.has(j.id)).reduce((s, j) => s + (j.contract_value ?? 0), 0);
        return { member: m, count: ids.size, value };
      });

  const grouped = LANES.map((lane) => ({
    ...lane,
    rows: boardJobs.filter((job) => laneOf(job.id, assignmentByJob.get(job.id), readyIds) === lane.key),
  })).filter((g) => g.rows.length > 0);

  const tabs: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
    { key: "overview", label: "Overview", icon: ClipboardList },
    { key: "board", label: "Board", icon: LayoutGrid },
    { key: "map", label: "Map", icon: MapIcon },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          const tone = item.key === "overview" ? FILL_PURPLE : item.key === "board" ? FILL_BLUE : FILL_GREEN;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`${PILL} ${active ? tone : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
        <Link href="/install/calendar" className={`${PILL} text-muted-foreground hover:bg-muted`}>
          Calendar
        </Link>
        <Link href="/install/status" className={`${PILL} text-muted-foreground hover:bg-muted`}>
          Permit/HOA status
        </Link>
        <Link href="/install/invoices" className={`${PILL} text-muted-foreground hover:bg-muted`}>
          Installer invoices
        </Link>
        <Link href="/install?app=pm" className={`${PILL} text-muted-foreground hover:bg-muted`}>
          Project manager app</Link><Link href="/service?app=request&source=install" className={`${PILL} text-muted-foreground hover:bg-muted`}>Request service
        </Link>
      </nav>

      {mail ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{mail}</p>
      ) : null}
      {tableNote ? <p className="text-sm text-amber-700">{tableNote}</p> : null}

      {tab === "overview" ? (
        <Overview
          jobs={crewJobs}
          roster={roster}
          assignmentByJob={assignmentByJob}
          memberById={memberById}
          crewId={crewId}
          setCrewId={setCrewId}
          crewFocus={crewFocus}
          canManage={canManage}
          canCheck={canCheck}
          showMoney={showMoney}
          accountManagers={accountManagers}
          pms={pms}
          installers={installers}
          openId={openId}
          setOpenId={setOpenId}
          orgId={orgId}
          photoCountByJob={photoCountByJob}
          permitOnFile={permitOnFile}
        />
      ) : null}

      {tab === "board" ? (
        <BoardTab
          myTitle={myTitle}
          kpis={kpis}
          filter={filter}
          setFilter={setFilter}
          query={query}
          setQuery={setQuery}
          roster={roster}
          crewId={crewId}
          setCrewId={setCrewId}
          canManage={canManage}
          addable={addable}
          showMoney={showMoney}
          moneyBy={moneyBy}
          jobs={jobs}
          assignments={assignments}
          memberById={memberById}
          grouped={grouped}
          assignmentByJob={assignmentByJob}
          accountManagers={accountManagers}
          pms={pms}
          installers={installers}
          canCheck={canCheck}
          readyIds={readyIds}
          openId={openId}
          setOpenId={setOpenId}
        />
      ) : null}

      {tab === "map" ? (
        <InstallMap
          jobs={jobs.map((job) => {
            const a = assignmentByJob.get(job.id);
            const holder = a?.installer_id
              ? memberLabel(memberById.get(a.installer_id))
              : a?.pm_id
                ? memberLabel(memberById.get(a.pm_id))
                : "Unassigned";
            return { ...job, holder };
          })}
        />
      ) : null}
    </div>
  );
}

function Track({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const tone = ok ? FILL_GREEN : warn ? FILL_AMBER : "bg-muted text-muted-foreground";
  return <span className={`${TRACK} ${tone}`}>{label}</span>;
}

function moneyLabel(ok: boolean | null | undefined, amount: number | null | undefined, empty: string) {
  if (!ok) return empty;
  if (amount != null && amount > 0) return currency(amount).replace(/\.00$/, "");
  return "In";
}

function Overview({
  jobs,
  roster,
  assignmentByJob,
  memberById,
  crewId,
  setCrewId,
  crewFocus,
  canManage,
  canCheck,
  showMoney,
  accountManagers,
  pms,
  installers,
  openId,
  setOpenId,
  orgId,
  photoCountByJob,
  permitOnFile,
}: {
  jobs: InstallJob[];
  roster: InstallMember[];
  assignmentByJob: Map<string, InstallAssignment>;
  memberById: Map<string, InstallMember>;
  crewId: string;
  setCrewId: (id: string) => void;
  crewFocus?: InstallMember;
  canManage: boolean;
  canCheck: boolean;
  showMoney: boolean;
  accountManagers: InstallMember[];
  pms: InstallMember[];
  installers: InstallMember[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  orgId: string;
  photoCountByJob: Record<string, number>;
  permitOnFile: Set<string>;
}) {
  const [track, setTrack] = useState<
    "need_start" | "change_order" | "need_final" | "need_check" | "no_photos" | "permit_office" | "permit_out" | null
  >(null);

  const counts = useMemo(() => {
    let needStart = 0;
    let changeOrder = 0;
    let needFinal = 0;
    let needCheck = 0;
    let noPhotos = 0;
    let permitOffice = 0;
    let permitOut = 0;
    for (const job of jobs) {
      const a = assignmentByJob.get(job.id);
      if (!a?.deposit_collected) needStart += 1;
      if (a?.change_order) changeOrder += 1;
      if (!a?.final_payment_collected) needFinal += 1;
      if (!a?.pm_checked_at) needCheck += 1;
      if (!(photoCountByJob[job.id] ?? 0)) noPhotos += 1;
      if (a?.permit_checked_out_at) permitOut += 1;
      else permitOffice += 1;
    }
    return { needStart, changeOrder, needFinal, needCheck, noPhotos, permitOffice, permitOut };
  }, [jobs, assignmentByJob, photoCountByJob]);

  const shown = useMemo(() => {
    if (!track) return jobs;
    return jobs.filter((job) => {
      const a = assignmentByJob.get(job.id);
      if (track === "need_start") return !a?.deposit_collected;
      if (track === "change_order") return !!a?.change_order;
      if (track === "need_final") return !a?.final_payment_collected;
      if (track === "need_check") return !a?.pm_checked_at;
      if (track === "no_photos") return !(photoCountByJob[job.id] ?? 0);
      if (track === "permit_office") return !a?.permit_checked_out_at;
      if (track === "permit_out") return !!a?.permit_checked_out_at;
      return true;
    });
  }, [jobs, track, assignmentByJob, photoCountByJob]);

  const kpis: { key: typeof track; label: string; value: number; icon: typeof Briefcase; tone: KpiTone }[] = [
    { key: "need_start", label: "Need start $", value: counts.needStart, icon: DollarSign, tone: "warn" },
    { key: "change_order", label: "Change orders", value: counts.changeOrder, icon: CircleAlert, tone: "info" },
    { key: "need_final", label: "Need final", value: counts.needFinal, icon: DollarSign, tone: "warn" },
    { key: "need_check", label: "Need check", value: counts.needCheck, icon: ListChecks, tone: "warn" },
    { key: "no_photos", label: "No photos", value: counts.noPhotos, icon: ClipboardList, tone: "info" },
    { key: "permit_office", label: "Permit in office", value: counts.permitOffice, icon: Briefcase, tone: "accent" },
    { key: "permit_out", label: "Permit out", value: counts.permitOut, icon: CheckCircle2, tone: "good" },
  ];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Install tracker</p>
        <h1 className="mt-1 font-heading text-3xl text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every ongoing install — start payment, change order, final, job check, photos, permit on file, permit out.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpis.map((item) => (
          <KpiCard
            key={item.key}
            label={item.label}
            value={item.value}
            icon={item.icon}
            tone={item.tone}
            active={track === item.key}
            onClick={() => setTrack((prev) => (prev === item.key ? null : item.key))}
          />
        ))}
      </div>

      {canManage ? (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_ORDER.map((role) => {
            const people = roster.filter((m) => m.role === role);
            return (
              <div key={role} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {ROLE_GROUP[role]}
                </p>
                {people.length === 0 ? (
                  <p className="px-1.5 py-1.5 text-sm text-muted-foreground">None yet</p>
                ) : (
                  <div className="space-y-2">
                    {people.map((m) => {
                      const active = crewId === m.id;
                      const stats = crewStats(role, m.id, jobs, assignmentByJob);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setCrewId(active ? "" : m.id)}
                          className={`flex w-full flex-col items-start gap-1 rounded-xl px-1.5 py-1.5 text-left hover:bg-muted/50 ${active ? "bg-primary/10" : ""}`}
                        >
                          <span className="text-base font-medium">{personName(m)}</span>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`${CREW_CHIP} bg-primary text-primary-foreground`}>
                              {stats.total} active
                            </span>
                            <span className={`${CREW_CHIP} ${FILL_PURPLE}`}>
                              {stats.scheduled} scheduled
                            </span>
                            <span className={`${CREW_CHIP} ${FILL_BLUE}`}>
                              {stats.inProgress} in progress
                            </span>
                            <span className={`${CREW_CHIP} ${FILL_GREEN}`}>
                              {stats.pendingFinal} pending final
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      {crewFocus && canManage ? (
        <p className="text-sm text-muted-foreground">
          Showing jobs for <span className="font-medium text-foreground">{personName(crewFocus)}</span>
          {" · "}
          <button type="button" onClick={() => setCrewId("")} className="text-primary underline-offset-2 hover:underline">
            Show all
          </button>
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className="px-2 py-6 text-sm text-muted-foreground">No jobs on this filter.</p>
      ) : (
        <div className="space-y-0.5">
          <div className={`${TRACKER_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
            <span />
            <span>Job #</span>
            <span>Client</span>
            <span>City</span>
            <span>Start $</span>
            <span>CO</span>
            <span>Final</span>
            <span>Check</span>
            <span>Photos</span>
            <span>Permit</span>
            <span>Out</span>
          </div>
          {shown.map((job) => {
            const a = assignmentByJob.get(job.id);
            const am = a?.account_manager_id ? memberById.get(a.account_manager_id) : undefined;
            const pm = a?.pm_id ? memberById.get(a.pm_id) : undefined;
            const inst = a?.installer_id ? memberById.get(a.installer_id) : undefined;
            const open = openId === job.id;
            const photos = photoCountByJob[job.id] ?? 0;
            const permitFile = permitOnFile.has(job.id) || Boolean(job.permit_number);
            return (
              <article key={job.id}>
                <button type="button" onClick={() => setOpenId(open ? null : job.id)} className={`${TRACKER_GRID} cursor-pointer rounded-xl px-2 py-1.5 text-left hover:bg-muted/40`}>
                  {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className={JOB_CHIP}>{job.job_number}</span>
                  <span className="min-w-0">
                    <span className={HUG_NAME} title={job.client_name}>
                      <span className="truncate">{job.client_name}</span>
                    </span>
                  </span>
                  <span className={CELL}>{job.city || job.address || "—"}</span>
                  <Track ok={!!a?.deposit_collected} label={moneyLabel(a?.deposit_collected, a?.deposit_amount, "Due")} />
                  <Track warn={!!a?.change_order} label={a?.change_order ? "CO" : "—"} />
                  <Track ok={!!a?.final_payment_collected} label={moneyLabel(a?.final_payment_collected, a?.final_payment_amount, "Due")} />
                  <Track ok={!!a?.pm_checked_at} label={a?.pm_checked_at ? "In" : "—"} />
                  <Track ok={photos > 0} label={photos ? String(photos) : "0"} />
                  <Track ok={permitFile} label={permitFile ? "On file" : "—"} />
                  <Track ok={!!a?.permit_checked_out_at} warn={!a?.permit_checked_out_at && permitFile} label={a?.permit_checked_out_at ? "Out" : "Office"} />
                </button>
                {open ? (
                  <div className="space-y-3 px-6 py-3">
                    <p className="text-sm text-muted-foreground">
                      {[job.address, job.city].filter(Boolean).join(", ") || "No address"}
                      {showMoney && job.contract_value != null ? ` · ${currency(job.contract_value)}` : ""}
                      {am ? ` · AM ${personName(am)}` : ""}
                      {pm ? ` · PM ${personName(pm)}` : ""}
                      {inst ? ` · ${personName(inst)}` : ""}
                      {a?.inspection_date ? ` · Inspection ${inspectionLabel(a.inspection_date)}` : ""}
                    </p>
                    {canManage ? (
                      <form action={assignAccountManager} className="flex flex-wrap items-end gap-3">
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="jobNumber" value={job.job_number} />
                        <label className="text-xs">
                          Account manager
                          <select name="accountManagerId" defaultValue={a?.account_manager_id ?? ""} className={SELECT}>
                            <option value="">Unassigned</option>
                            {accountManagers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {memberLabel(m)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className={BTN_BLUE} type="submit">
                          Save AM
                        </button>
                      </form>
                    ) : null}
                    {canManage ? (
                      <form action={assignInstallJob} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="jobNumber" value={job.job_number} />
                        <label className="text-xs">
                          Project manager
                          <select name="pmId" defaultValue={a?.pm_id ?? ""} className={SELECT}>
                            <option value="">None</option>
                            {pms.map((m) => (
                              <option key={m.id} value={m.id}>
                                {memberLabel(m)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs">
                          Installer
                          <select name="installerId" defaultValue={a?.installer_id ?? ""} className={SELECT}>
                            <option value="">Unassigned</option>
                            {installers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {memberLabel(m)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs">
                          Inspection date
                          <input name="inspectionDate" type="date" defaultValue={a?.inspection_date ?? ""} className={SELECT} />
                        </label>
                        <label className="text-xs">
                          Result
                          <select name="inspectionResult" defaultValue={a?.inspection_result ?? ""} className={SELECT}>
                            <option value="">Scheduled / waiting</option>
                            <option value="passed">Passed</option>
                            <option value="failed">Failed</option>
                          </select>
                        </label>
                        <button className={`${BTN_BLUE} w-fit sm:col-span-2 lg:col-span-4`} type="submit">
                          Save crew
                        </button>
                      </form>
                    ) : null}
                    <InstallJobDetail
                      job={job}
                      assignment={a}
                      installer={inst}
                      pm={pm}
                      orgId={orgId}
                      canManage={canManage}
                      canCheck={canCheck}
                      embedded
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BoardTab({
  myTitle,
  kpis,
  filter,
  setFilter,
  query,
  setQuery,
  roster,
  crewId,
  setCrewId,
  canManage,
  addable,
  showMoney,
  moneyBy,
  jobs,
  assignments,
  memberById,
  grouped,
  assignmentByJob,
  accountManagers,
  pms,
  installers,
  canCheck,
  readyIds,
  openId,
  setOpenId,
}: {
  myTitle: string;
  kpis: { key: Filter; label: string; value: string | number; icon: typeof Briefcase; tone: KpiTone }[];
  filter: Filter;
  setFilter: (f: Filter) => void;
  query: string;
  setQuery: (q: string) => void;
  roster: InstallMember[];
  crewId: string;
  setCrewId: (id: string) => void;
  canManage: boolean;
  addable: InstallJob[];
  showMoney: boolean;
  moneyBy: (role: string) => { member: InstallMember; count: number; value: number }[];
  jobs: InstallJob[];
  assignments: InstallAssignment[];
  memberById: Map<string, InstallMember>;
  grouped: { key: Lane; label: string; rows: InstallJob[] }[];
  assignmentByJob: Map<string, InstallAssignment>;
  accountManagers: InstallMember[];
  pms: InstallMember[];
  installers: InstallMember[];
  canCheck: boolean;
  readyIds: Set<string>;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const paymentSummary = useMemo(() => {
    let depositTotal = 0;
    let finalTotal = 0;
    let paidInFull = 0;
    for (const job of jobs) {
      const a = assignmentByJob.get(job.id);
      if (a?.deposit_collected) depositTotal += a.deposit_amount ?? 0;
      if (a?.final_payment_collected) {
        finalTotal += a.final_payment_amount ?? 0;
        if (a.deposit_collected) paidInFull += 1;
      }
    }
    return { depositTotal, finalTotal, collected: depositTotal + finalTotal, paidInFull };
  }, [jobs, assignmentByJob]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Board</h1>
        <p className="text-sm text-muted-foreground">Signed in as {myTitle}. Status lanes, money, and the next action on every job.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {kpis.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            active={card.key != null && filter === card.key}
            onClick={card.key == null ? undefined : () => setFilter(filter === card.key ? null : card.key)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Job number, address, city…" className="pl-8" />
        </div>
        {canManage ? (
          <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className={SELECT + " max-w-xs"}>
            <option value="">All crew</option>
            {roster.map((m) => (
              <option key={m.id} value={m.id}>
                {ROLE_LABEL[m.role] ?? m.role} · {memberLabel(m)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="space-y-4">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No install jobs match this view.</p>
        ) : (
          grouped.map((group) => (
            <section key={group.key} className="space-y-1">
              <div className={ROW}>
                <span className={`${PILL} ${
                  group.key === "need_schedule" || group.key === "need_am"
                    ? FILL_PURPLE
                    : group.key === "scheduled" || group.key === "passed"
                      ? FILL_GREEN
                      : group.key === "failed"
                        ? "bg-red-600 text-white"
                        : FILL_BLUE
                }`}>{group.label}</span>
                <span className="text-sm text-muted-foreground">({group.rows.length})</span>
                {showMoney ? (
                  <span className="ml-auto text-sm font-medium text-primary">
                    {currency(group.rows.reduce((s, j) => s + (j.contract_value ?? 0), 0))}
                  </span>
                ) : null}
              </div>
              <ul className="space-y-0.5">
                <li className={`${BOARD_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
                  <span />
                  <span>Job #</span>
                  <span>Client</span>
                  <span>City</span>
                  <span>AM</span>
                  <span>PM</span>
                  <span>Installer</span>
                  <span />
                </li>
                {group.rows.map((job) => {
                  const a = assignmentByJob.get(job.id);
                  const am = a?.account_manager_id ? memberById.get(a.account_manager_id) : undefined;
                  const pm = a?.pm_id ? memberById.get(a.pm_id) : undefined;
                  const inst = a?.installer_id ? memberById.get(a.installer_id) : undefined;
                  const open = openId === job.id;
                  return (
                    <li key={job.id}>
                      <div
                        className={`${BOARD_GRID} cursor-pointer rounded-xl px-2 py-1.5 hover:bg-muted/50`}
                        onClick={() => setOpenId(open ? null : job.id)}
                      >
                        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <Link href={`/jobs/${job.id}`} onClick={(e) => e.stopPropagation()} className={JOB_CHIP}>
                          {job.job_number}
                        </Link>
                        <span className="min-w-0">
                          <span className={HUG_NAME} title={job.client_name}>
                            <span className="truncate">{job.client_name}</span>
                          </span>
                        </span>
                        <span className={`${CELL} truncate`} title={job.address || undefined}>
                          {job.city || "—"}
                        </span>
                        <CrewName m={am} />
                        <CrewName m={pm} />
                        <CrewName m={inst} />
                        {group.key === "need_schedule" ? (
                          <form
                            action={scheduleInstallJob}
                            className="flex items-center gap-1.5 justify-self-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input type="hidden" name="jobId" value={job.id} />
                            <input type="hidden" name="jobNumber" value={job.job_number} />
                            <input type="date" name="scheduledDate" required defaultValue={a?.scheduled_date || tomorrow()} className={DATE_INPUT} />
                            <button type="submit" className={SCHEDULE_BTN}>
                              <CalendarPlus className="h-3.5 w-3.5" />
                              Schedule now
                            </button>
                          </form>
                        ) : (
                          <span />
                        )}
                      </div>
                      {open ? (
                        <div className="space-y-3 px-8 py-2">
                          {canManage ? <MoneySection job={job} assignment={a} /> : null}
                          {canManage ? (
                            <form action={assignAccountManager} className="flex flex-wrap items-end gap-3">
                              <input type="hidden" name="jobId" value={job.id} />
                              <input type="hidden" name="jobNumber" value={job.job_number} />
                              <label className="text-xs">
                                Account manager
                                <select name="accountManagerId" defaultValue={a?.account_manager_id ?? ""} className={SELECT}>
                                  <option value="">Unassigned</option>
                                  {accountManagers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {memberLabel(m)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button className={BTN_BLUE} type="submit">
                                Save AM
                              </button>
                            </form>
                          ) : null}
                          {canManage ? (
                            <form action={assignInstallJob} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <input type="hidden" name="jobId" value={job.id} />
                              <input type="hidden" name="jobNumber" value={job.job_number} />
                              <label className="text-xs">
                                Project manager
                                <select name="pmId" defaultValue={a?.pm_id ?? ""} className={SELECT}>
                                  <option value="">None</option>
                                  {pms.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {memberLabel(m)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs">
                                Installer
                                <select name="installerId" defaultValue={a?.installer_id ?? ""} className={SELECT}>
                                  <option value="">Unassigned</option>
                                  {installers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {memberLabel(m)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs">
                                Inspection date
                                <input name="inspectionDate" type="date" defaultValue={a?.inspection_date ?? ""} className={SELECT} />
                              </label>
                              <label className="text-xs">
                                Result
                                <select name="inspectionResult" defaultValue={a?.inspection_result ?? ""} className={SELECT}>
                                  <option value="">Scheduled / waiting</option>
                                  <option value="passed">Passed</option>
                                  <option value="failed">Failed</option>
                                </select>
                              </label>
                              <button className={`${BTN_BLUE} sm:col-span-2 lg:col-span-4`} type="submit">
                                Save crew
                              </button>
                            </form>
                          ) : null}
                          {canCheck ? (
                            <form action={checkInstallJob}>
                              <input type="hidden" name="jobId" value={job.id} />
                              <input type="hidden" name="jobNumber" value={job.job_number} />
                              <button className={BTN_GREEN} type="submit">
                                {a?.pm_checked_at ? "Check again" : "Check job"}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {canManage ? (
        <details className="group space-y-3">
          <summary className={`${ROW} cursor-pointer list-none`}>
            <span>Board admin &amp; money</span>
            <span className="text-xs text-muted-foreground group-open:hidden">Add jobs, add crew, money by person</span>
          </summary>
          <div className="space-y-6 px-2">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <p className={`${PILL} ${FILL_BLUE}`}>Add a job to the board</p>
                <p className="text-sm text-muted-foreground">Job number is the source of truth. Install only pulls permitted work.</p>
                <form action={addJobToInstallBoard} className="flex flex-wrap items-end gap-3">
                    <label className="text-xs">
                      Job
                      <select name="jobId" className={SELECT + " min-w-[220px]"} defaultValue="">
                        <option value="">Select job number</option>
                        {addable.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.job_number} · {job.client_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className={BTN_BLUE} type="submit">
                      Add
                    </button>
                  </form>
              </div>
              <div className="space-y-2">
                <p className={`${PILL} ${FILL_GREEN}`}>Add crew</p>
                <p className="text-sm text-muted-foreground">
                  Adds them to the roster right away. They sign in with the company join code — no email invite needed.
                </p>
                  <form action={addInstallMember} className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs sm:col-span-2">
                      Email
                      <input name="email" type="email" required className={SELECT} />
                    </label>
                    <label className="text-xs">
                      Role
                      <select name="role" className={SELECT} defaultValue="installer">
                        <option value="account_manager">Account manager</option>
                        <option value="project_manager">Project manager</option>
                        <option value="installer">Installer</option>
                      </select>
                    </label>
                    <label className="text-xs">
                      Name
                      <input name="displayName" className={SELECT} />
                    </label>
                    <label className="text-xs sm:col-span-2">
                      Company
                      <input name="companyName" className={SELECT} />
                    </label>
                    <button className={`${BTN_GREEN} w-fit sm:col-span-2`} type="submit">
                      Add to roster
                    </button>
                  </form>
              </div>
            </div>
            {showMoney ? (
              <div className="space-y-2">
                <p className={`${PILL} ${FILL_AMBER}`}>Money out by who</p>
                <p className="text-sm text-muted-foreground">
                    {currency(paymentSummary.collected)} collected so far
                    {" "}({currency(paymentSummary.depositTotal)} deposits, {currency(paymentSummary.finalTotal)} final)
                    {" · "}{paymentSummary.paidInFull} job{paymentSummary.paidInFull === 1 ? "" : "s"} paid in full
                </p>
                <div className="grid gap-4 lg:grid-cols-3">
                  {(["account_manager", "project_manager", "installer"] as const).map((role) => (
                    <div key={role}>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[role]}</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {moneyBy(role).length === 0 ? (
                          <li className="text-muted-foreground">None yet</li>
                        ) : (
                          moneyBy(role).map(({ member, count, value }) => (
                            <li key={member.id} className="flex justify-between gap-2">
                              <span>
                                {memberLabel(member)}{" "}
                                <span className="text-muted-foreground">({count})</span>
                              </span>
                              <span className="font-medium">{currency(value)}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
