"use client";

import { createElement as h, useMemo, useState } from "react";
import Link from "next/link";
import {
    Briefcase,
    CalendarClock,
    CheckCircle2,
    ClipboardList,
    LifeBuoy,
    MapPin,
    Printer,
    Route,
    Search,
    Users,
} from "lucide-react";
import { KpiCard, type KpiTone } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { APP_GRID, BTN_BLUE, CELL, FIELD, JOB_BTN, NAME_PILL, PILL } from "@/lib/ui/chrome";
import { addJobToServiceBoard, addServiceMember, assignServiceJob, updateServiceRoute } from "./actions";
import type { ServiceTicket } from "./service-tech-app";
import { ServiceRouteMap } from "./service-route-map";

export type ServiceMember = {
    id: string;
    email: string;
    role: string;
    user_id: string | null;
    display_name?: string | null;
    company_name?: string | null;
    org_id?: string;
};

export type ServiceAssignment = {
    job_id: string;
    job_number: string;
    service_tech_id: string | null;
    scheduled_date: string | null;
    scheduled_start_time: string | null;
    scheduled_end_time: string | null;
    status: string;
    priority: string;
    issue_description: string;
    requested_by_name: string | null;
    request_source: string | null;
    requested_date: string | null;
    route_order: number | null;
    lat: number | null;
    lng: number | null;
};

export type ServiceJob = {
    id: string;
    job_number: string;
    client_name: string;
    address: string | null;
    city: string | null;
    trade_type: string | null;
    permit_number: string | null;
};

type Lane = "need_tech" | "scheduled" | "completed";
type Filter = Lane | "on_board" | null;
type Tab = "board" | "calendar" | "routes";

const LANES: { key: Lane; label: string }[] = [
  { key: "need_tech", label: "Need service tech" },
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
  ];

const SOURCE_LABEL: Record<string, string> = {
    sales: "Sales",
    install: "Install board",
    permit: "Permit",
    hoa: "HOA",
    manager: "Management",
    service: "Service",
};

function memberLabel(m?: ServiceMember) {
    if (!m) return "Unassigned";
    const name = m.display_name?.trim();
    const company = m.company_name?.trim();
    if (name && company) return `${name} · ${company}`;
    return name || company || m.email;
}

function laneOf(a?: ServiceAssignment): Lane {
    if (a?.status === "completed") return "completed";
    if (a?.service_tech_id && (a.scheduled_date || a.status === "scheduled")) return "scheduled";
    return "need_tech";
}

function toMinutes(t: string | null): number | null {
    if (!t) return null;
    const parts = t.split(":");
    const h1 = Number(parts[0]);
    const m1 = Number(parts[1] ?? "0");
    if (Number.isNaN(h1)) return null;
    return h1 * 60 + (Number.isNaN(m1) ? 0 : m1);
}

function formatTime(t: string | null): string {
    const mins = toMinutes(t);
    if (mins == null) return "";
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, delta: number) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + delta);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function googleRouteUrl(stops: { address: string | null; city: string | null }[]) {
    const addrs = stops.map((s) => [s.address, s.city].filter(Boolean).join(", ")).filter(Boolean).map(encodeURIComponent);
    if (addrs.length === 0) return null;
    if (addrs.length === 1) {
          return `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${addrs[0]}&travelmode=driving`;
    }
    const dest = addrs[addrs.length - 1];
    const waypoints = addrs.slice(0, -1).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
}

const DAY_START = 7 * 60;
const DAY_END = 19 * 60;
const DAY_SPAN = DAY_END - DAY_START;
const DEFAULT_DURATION = 60;

export function ServiceDashboard({
    jobs,
    assignments,
    members,
    addable,
    mail,
    tableNote,
    signedInName,
    orgName,
    canManage,
    tickets,
}: {
    jobs: ServiceJob[];
    assignments: ServiceAssignment[];
    members: ServiceMember[];
    addable: ServiceJob[];
    mail?: string;
    tableNote?: string;
    signedInName: string;
    orgName: string;
    canManage: boolean;
    tickets: ServiceTicket[];
}) {
    const [tab, setTab] = useState<Tab>("board");
    const [filter, setFilter] = useState<Filter>(null);
    const [query, setQuery] = useState("");
    const [openId, setOpenId] = useState<string | null>(null);
    const [activeDate, setActiveDate] = useState(todayStr());

  const assignmentByJob = useMemo(() => new Map(assignments.map((a) => [a.job_id, a])), [assignments]);
    const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
    const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
    const techs = members.filter((m) => m.role === "service_tech");

  const roster = useMemo(() => {
        const list = [...members];
        if (!list.some((m) => m.role === "service_manager") && canManage) {
                list.unshift({
                          id: "self-manager",
                          email: signedInName,
                          role: "service_manager",
                          user_id: null,
                          display_name: signedInName.includes("@") ? signedInName.split("@")[0] : signedInName,
                          company_name: orgName,
                });
        }
        return list;
  }, [members, canManage, signedInName, orgName]);

  const boardJobs = useMemo(() => {
        let list = jobs;
        const q = query.trim().toLowerCase();
        if (q) {
                list = list.filter(
                          (job) =>
                                      job.job_number.toLowerCase().includes(q) ||
                                      job.client_name.toLowerCase().includes(q) ||
                                      (job.address ?? "").toLowerCase().includes(q) ||
                                      (job.city ?? "").toLowerCase().includes(q),
                        );
        }
        if (filter && filter !== "on_board") list = list.filter((job) => laneOf(assignmentByJob.get(job.id)) === filter);
        return list;
  }, [jobs, query, filter, assignmentByJob]);

  // Jobs that are not on the service board yet but match the search, so searching finds any job in the shop.
  const otherMatches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [] as ServiceJob[];
        return addable
          .filter(
                    (job) =>
                                job.job_number.toLowerCase().includes(q) ||
                                job.client_name.toLowerCase().includes(q) ||
                                (job.address ?? "").toLowerCase().includes(q) ||
                                (job.city ?? "").toLowerCase().includes(q) ||
                                (job.permit_number ?? "").toLowerCase().includes(q),
                  )
          .slice(0, 8);
  }, [addable, query]);

  const counts = useMemo(() => {
        const byLane: Record<Lane, number> = { need_tech: 0, scheduled: 0, completed: 0 };
        for (const job of jobs) byLane[laneOf(assignmentByJob.get(job.id))] += 1;
        return { ...byLane, on_board: jobs.length };
  }, [jobs, assignmentByJob]);

  const kpis: { key: Filter; label: string; value: number; icon: typeof Briefcase; tone: KpiTone }[] = [
    { key: "on_board", label: "On board", value: counts.on_board, icon: Briefcase, tone: "neutral" },
    { key: "need_tech", label: "Need tech", value: counts.need_tech, icon: Users, tone: "warn" },
    { key: "scheduled", label: "Scheduled", value: counts.scheduled, icon: CalendarClock, tone: "accent" },
    { key: "completed", label: "Completed", value: counts.completed, icon: CheckCircle2, tone: "good" },
      ];

  const grouped = LANES.map((lane) => ({
        ...lane,
        rows: boardJobs.filter((job) => laneOf(assignmentByJob.get(job.id)) === lane.key),
  })).filter((g) => g.rows.length > 0);

  const dayAssignments = useMemo(
        () => assignments.filter((a) => a.scheduled_date === activeDate && a.service_tech_id),
        [assignments, activeDate],
      );

  const tabsList: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
    { key: "board", label: "Board", icon: ClipboardList },
    { key: "calendar", label: "Calendar", icon: CalendarClock },
    { key: "routes", label: "Routes", icon: Route },
      ];

  const headerEl = h(
        "header",
    { className: "flex flex-wrap items-start justify-between gap-3" },
        h(
                "div",
                null,
                h("h1", { className: "font-heading text-2xl font-semibold tracking-tight" }, "Service Dashboard"),
                h(
                          "p",
                  { className: "text-sm text-muted-foreground" },
                          "Requests come in from Sales, Install, Permit, HOA, and Management. Assign a tech, set the date and time.",
                        ),
              ),
        h(
                "div",
          { className: "flex flex-wrap gap-2" },
                h(
                          Link,
                  { href: "/service?app=request&source=service", className: `${PILL} ${FILL_PURPLE}` },
                          h(ClipboardList, { className: "h-3.5 w-3.5" }),
                          "Request service",
                        ),
                h(
                          Link,
                  { href: "/service/reports?range=day", className: `${PILL} ${FILL_BLUE}` },
                          h(Printer, { className: "h-3.5 w-3.5" }),
                          "Daily report",
                        ),
                h(
                          Link,
                  { href: "/service/reports?range=week", className: `${PILL} ${FILL_GREEN}` },
                          h(Printer, { className: "h-3.5 w-3.5" }),
                          "Weekly report",
                        ),
                h(
                          Link,
                  { href: "/service?app=tech", className: `${PILL} ${FILL_GREEN}` },
                          h(LifeBuoy, { className: "h-3.5 w-3.5" }),
                          "Service tech app",
                        ),
              ),
      );

  const navEl = h(
        "nav",
    { className: "flex flex-wrap items-center gap-1.5" },
        tabsList.map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                const tone = item.key === "board" ? FILL_BLUE : item.key === "calendar" ? FILL_PURPLE : FILL_GREEN;
                return h(
                          "button",
                  {
                              key: item.key,
                              type: "button",
                              onClick: () => setTab(item.key),
                              className: `${PILL} ${active ? tone : "text-muted-foreground hover:bg-muted"}`,
                  },
                          h(Icon, { className: "h-3.5 w-3.5" }),
                          item.label,
                        );
        }),
      );

  const boardRows = grouped.map((group) =>
        h(
                "section",
          { key: group.key, className: "space-y-1" },
                h(
                          "h2",
                  { className: "px-2 text-sm font-medium" },
                          group.label,
                          " ",
                          h("span", { className: "text-muted-foreground" }, `(${group.rows.length})`),
                        ),
                h(
                          "div",
                  { className: `${APP_GRID} px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground` },
                          h("span", null),
                          h("span", null, "Job #"),
                          h("span", null, "Client"),
                          h("span", { className: "hidden sm:block" }, "Tech"),
                        ),
                group.rows.map((job) => {
                          const a = assignmentByJob.get(job.id);
                          const tech = a?.service_tech_id ? memberById.get(a.service_tech_id) : undefined;
                          const open = openId === job.id;
                          return h(
                                      "article",
                            { key: job.id },
                                      h(
                                                    "button",
                                        {
                                                        type: "button",
                                                        onClick: () => setOpenId(open ? null : job.id),
                                                        className: `${APP_GRID} cursor-pointer rounded-xl px-2 py-1.5 text-left hover:bg-muted/40`,
                                        },
                                                    h("span", { className: "text-muted-foreground" }, open ? "▾" : "▸"),
                                                    h("span", { className: JOB_BTN }, job.job_number),
                                                    h("span", { className: NAME_PILL }, job.client_name),
                                                    h("span", { className: `${CELL} hidden sm:block` }, memberLabel(tech)),
                                                  ),
                                      open
                                        ? h(
                                                          "div",
                                          { className: "space-y-3 px-8 pb-4" },
                                                          h(
                                                                              "p",
                                                            { className: "text-sm text-muted-foreground" },
                                                                              [job.address, job.city].filter(Boolean).join(", ") || "No address",
                                                                              a?.scheduled_date ? ` · ${a.scheduled_date}` : "",
                                                                              a?.scheduled_start_time ? ` ${formatTime(a.scheduled_start_time)}` : "",
                                                                              a?.scheduled_end_time ? `–${formatTime(a.scheduled_end_time)}` : "",
                                                                            ),
                                                          a?.issue_description
                                                            ? h(
                                                                                    "p",
                                                              { className: "text-sm" },
                                                                                    h("span", { className: "font-medium" }, "Requested: "),
                                                                                    a.issue_description,
                                                                                    a.requested_by_name ? ` — ${a.requested_by_name}` : "",
                                                                                    a.request_source ? ` (${SOURCE_LABEL[a.request_source] ?? a.request_source})` : "",
                                                                                  )
                                                            : null,
                                                          tickets.find((t) => t.job_id === job.id)?.issue
                                                            ? h(
                                                                                    "p",
                                                              { className: "text-sm" },
                                                                                    h("span", { className: "font-medium" }, "Last ticket: "),
                                                                                    tickets.find((t) => t.job_id === job.id)?.issue,
                                                                                  )
                                                            : null,
                                                          canManage
                                                            ? h(
                                                                                    "form",
                                                              { action: assignServiceJob, className: "flex flex-wrap items-end gap-3" },
                                                                                    h("input", { type: "hidden", name: "jobId", value: job.id }),
                                                                                    h("input", { type: "hidden", name: "jobNumber", value: job.job_number }),
                                                                                    h(
                                                                                                              "label",
                                                                                      { className: "text-xs" },
                                                                                                              "Service tech",
                                                                                                              h(
                                                                                                                                          "select",
                                                                                                                { name: "serviceTechId", defaultValue: a?.service_tech_id ?? "", className: FIELD },
                                                                                                                                          h("option", { value: "" }, "Unassigned"),
                                                                                                                                          techs.map((m) => h("option", { key: m.id, value: m.id }, memberLabel(m))),
                                                                                                                                        ),
                                                                                                            ),
                                                                                    h(
                                                                                                              "label",
                                                                                      { className: "text-xs" },
                                                                                                              "Date",
                                                                                                              h("input", { type: "date", name: "scheduledDate", defaultValue: a?.scheduled_date ?? "", className: FIELD }),
                                                                                                            ),
                                                                                    h(
                                                                                                              "label",
                                                                                      { className: "text-xs" },
                                                                                                              "Start time",
                                                                                                              h("input", { type: "time", name: "scheduledStartTime", defaultValue: a?.scheduled_start_time ?? "", className: FIELD }),
                                                                                                            ),
                                                                                    h(
                                                                                                              "label",
                                                                                      { className: "text-xs" },
                                                                                                              "End time",
                                                                                                              h("input", { type: "time", name: "scheduledEndTime", defaultValue: a?.scheduled_end_time ?? "", className: FIELD }),
                                                                                                            ),
                                                                                    h(
                                                                                                              "label",
                                                                                      { className: "text-xs" },
                                                                                                              "Status",
                                                                                                              h(
                                                                                                                                          "select",
                                                                                                                { name: "status", defaultValue: a?.status ?? "open", className: FIELD },
                                                                                                                                          h("option", { value: "open" }, "Open"),
                                                                                                                                          h("option", { value: "scheduled" }, "Scheduled"),
                                                                                                                                          h("option", { value: "completed" }, "Completed"),
                                                                                                                                          h("option", { value: "cancelled" }, "Cancelled"),
                                                                                                                                        ),
                                                                                                            ),
                                                                                    h("button", { className: BTN_BLUE, type: "submit" }, "Save assignment"),
                                                                                  )
                                                            : null,
                                                          h(Link, { href: `/jobs/${job.id}`, className: BTN_BLUE }, "Open job"),
                                                        )
                                        : null,
                                    );
                }),
              ),
                                  );

  const adminEl = canManage
      ? h(
                "div",
        { className: "grid gap-4 lg:grid-cols-2" },
                h(
                            "section",
                  { className: "space-y-3 rounded-2xl border p-4" },
                            h("h2", { className: "font-heading text-base font-semibold" }, "Add a job to the board"),
                            h("p", { className: "text-sm text-muted-foreground" }, "Job number is the source of truth. Service pulls the same jobs as install."),
                            h(
                                          "form",
                              { action: addJobToServiceBoard, className: "flex flex-wrap items-end gap-3" },
                                          h(
                                                          "label",
                                            { className: "text-xs" },
                                                          "Job",
                                                          h(
                                                                            "select",
                                                            { name: "jobId", className: `${FIELD} min-w-[220px]`, defaultValue: "" },
                                                                            h("option", { value: "" }, "Select job number"),
                                                                            addable.map((job) => h("option", { key: job.id, value: job.id }, `${job.job_number} · ${job.client_name}`)),
                                                                          ),
                                                        ),
                                          h("button", { className: BTN_BLUE, type: "submit" }, "Add"),
                                        ),
                          ),
                h(
                            "section",
                  { className: "space-y-3 rounded-2xl border p-4" },
                            h("h2", { className: "font-heading text-base font-semibold" }, "Add crew"),
                            h("p", { className: "text-sm text-muted-foreground" }, "Service tech sees only jobs assigned to them. No money on that app."),
                            h(
                                          "form",
                              { action: addServiceMember, className: "grid gap-3 sm:grid-cols-2" },
                                          h(
                                                          "label",
                                            { className: "text-xs sm:col-span-2" },
                                                          "Email",
                                                          h("input", { name: "email", type: "email", required: true, className: FIELD }),
                                                        ),
                                          h(
                                                          "label",
                                            { className: "text-xs" },
                                                          "Role",
                                                          h(
                                                                            "select",
                                                            { name: "role", className: FIELD, defaultValue: "service_tech" },
                                                                            h("option", { value: "service_tech" }, "Service tech"),
                                                                            h("option", { value: "service_manager" }, "Service manager"),
                                                                          ),
                                                        ),
                                          h("label", { className: "text-xs" }, "Name", h("input", { name: "displayName", className: FIELD })),
                                          h("button", { className: `${PILL} ${FILL_PURPLE} h-11 justify-center sm:col-span-2`, type: "submit" }, "Add to roster"),
                                        ),
                            h(
                                          "ul",
                              { className: "space-y-1 text-sm" },
                                          roster.map((m) =>
                                                          h(
                                                                            "li",
                                                            { key: m.id, className: "flex items-center justify-between gap-2" },
                                                                            h(
                                                                                                "span",
                                                                                                null,
                                                                                                memberLabel(m),
                                                                                                " ",
                                                                                                h("span", { className: "text-muted-foreground" }, `· ${m.role === "service_manager" ? "Manager" : "Tech"}`),
                                                                                              ),
                                                                          ),
                                                                 ),
                                        ),
                          ),
              )
        : null;

  const otherEl =
        otherMatches.length > 0
          ? h(
                  "section",
                  { className: "space-y-2 rounded-2xl border p-4" },
                  h("h2", { className: "font-heading text-base font-semibold" }, "Not on the service board yet"),
                  h(
                          "p",
                          { className: "text-sm text-muted-foreground" },
                          canManage
                            ? "These jobs match your search. Add one to put it on the board."
                            : "These jobs match your search but are not on the service board.",
                        ),
                  h(
                          "ul",
                          { className: "space-y-2" },
                          otherMatches.map((job) =>
                                    h(
                                              "li",
                                              { key: job.id, className: "flex flex-wrap items-center justify-between gap-2 text-sm" },
                                              h(
                                                        "span",
                                                        null,
                                                        h("span", { className: JOB_BTN }, job.job_number),
                                                        ` ${job.client_name}${job.address ? ` · ${job.address}` : ""}${job.city ? `, ${job.city}` : ""}`,
                                                      ),
                                              canManage
                                                ? h(
                                                          "form",
                                                          { action: addJobToServiceBoard },
                                                          h("input", { type: "hidden", name: "jobId", value: job.id }),
                                                          h("button", { className: BTN_BLUE, type: "submit" }, "Add to board"),
                                                        )
                                                : null,
                                            ),
                                  ),
                        ),
                )
          : null;

  const boardEl = h(
        "div",
    { className: "space-y-6" },
        h(
                "div",
          { className: "grid grid-cols-2 gap-3 sm:grid-cols-4" },
                kpis.map((card) =>
                          h(KpiCard, {
                                      key: card.label,
                                      label: card.label,
                                      value: card.value,
                                      icon: card.icon,
                                      tone: card.tone,
                                      active: card.key != null && filter === card.key,
                                      onClick: () => setFilter(filter === card.key ? null : card.key),
                          }),
                               ),
              ),
        h(
                "div",
          { className: "relative min-w-[220px] max-w-md" },
                h(Search, { className: "pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" }),
                h(Input, { value: query, onChange: (e: { target: { value: string } }) => setQuery(e.target.value), placeholder: "Job number, address, city…", className: "pl-8" }),
              ),
        otherEl,
        grouped.length === 0
          ? h(
                  "p",
                  { className: "text-sm text-muted-foreground" },
                  query.trim() ? "No jobs on the service board match that search." : "No service jobs on this board yet.",
                )
          : boardRows,
        adminEl,
      );

  return h(
        "div",
    { className: "space-y-6" },
        headerEl,
        mail ? h("p", { className: "text-sm text-emerald-700" }, mail) : null,
        tableNote ? h("p", { className: "text-sm text-amber-700" }, tableNote) : null,
        navEl,
        tab === "board" ? boardEl : null,
        tab === "calendar"
          ? h(CalendarView, { activeDate, setActiveDate, techs, dayAssignments, jobById })
          : null,
        tab === "routes"
          ? h(RoutesView, { activeDate, setActiveDate, techs, dayAssignments, jobById, canManage })
          : null,
      );
}

function DateNav({ activeDate, setActiveDate }: { activeDate: string; setActiveDate: (d: string) => void }) {
    return h(
          "div",
      { className: "flex items-center gap-2" },
          h(
                  "button",
            { type: "button", className: `${PILL} text-muted-foreground hover:bg-muted`, onClick: () => setActiveDate(addDays(activeDate, -1)) },
                  "← Prev",
                ),
          h("input", {
                  type: "date",
                  value: activeDate,
                  onChange: (e: { target: { value: string } }) => setActiveDate(e.target.value),
                  className: FIELD,
          }),
          h(
                  "button",
            { type: "button", className: `${PILL} text-muted-foreground hover:bg-muted`, onClick: () => setActiveDate(todayStr()) },
                  "Today",
                ),
          h(
                  "button",
            { type: "button", className: `${PILL} text-muted-foreground hover:bg-muted`, onClick: () => setActiveDate(addDays(activeDate, 1)) },
                  "Next →",
                ),
        );
}

function CalendarView({
    activeDate,
    setActiveDate,
    techs,
    dayAssignments,
    jobById,
}: {
    activeDate: string;
    setActiveDate: (d: string) => void;
    techs: ServiceMember[];
    dayAssignments: ServiceAssignment[];
    jobById: Map<string, ServiceJob>;
}) {
    const byTech = useMemo(() => {
          const map = new Map<string, ServiceAssignment[]>();
          for (const a of dayAssignments) {
                  if (!a.service_tech_id) continue;
                  const list = map.get(a.service_tech_id) ?? [];
                  list.push(a);
                  map.set(a.service_tech_id, list);
          }
          return map;
    }, [dayAssignments]);

  const hourMarks: number[] = [];
    for (let m = DAY_START; m <= DAY_END; m += 60) hourMarks.push(m);

  const columns = techs.map((tech) => {
        const rows = byTech.get(tech.id) ?? [];
        const blocks = rows.map((a) => {
                const start = toMinutes(a.scheduled_start_time) ?? DAY_START;
                const end = toMinutes(a.scheduled_end_time) ?? start + DEFAULT_DURATION;
                const top = ((start - DAY_START) / DAY_SPAN) * 100;
                const height = Math.max(((end - start) / DAY_SPAN) * 100, 4);
                const job = jobById.get(a.job_id);
                return h(
                          "div",
                  {
                              key: a.job_id,
                              className: `absolute right-1 left-1 overflow-hidden rounded-lg px-2 py-1 text-[11px] text-white ${a.status === "completed" ? "bg-emerald-600" : "bg-primary"}`,
                              style: { top: `${top}%`, height: `${height}%` },
                  },
                          h("p", { className: "truncate font-semibold" }, job?.job_number ?? a.job_number),
                          h("p", { className: "truncate" }, job?.client_name ?? ""),
                          h(
                                      "p",
                            { className: "truncate opacity-80" },
                                      formatTime(a.scheduled_start_time),
                                      a.scheduled_end_time ? `–${formatTime(a.scheduled_end_time)}` : "",
                                    ),
                        );
        });
        const gridLines = hourMarks.map((m) =>
                h("div", {
                          key: m,
                          className: "absolute right-0 left-0 border-b border-dashed",
                          style: { top: `${((m - DAY_START) / DAY_SPAN) * 100}%` },
                }),
                                            );
        return h(
                "div",
          { key: tech.id, className: "relative w-56 shrink-0 border-r last:border-r-0" },
                h("div", { className: "flex h-10 items-center justify-center border-b px-2 text-xs font-semibold" }, memberLabel(tech)),
                h("div", { className: "relative", style: { height: `${(DAY_SPAN / 60) * 64}px` } }, gridLines, blocks),
              );
  });

  const timeColumn = h(
        "div",
    { className: "w-16 shrink-0 border-r" },
        h("div", { className: "h-10 border-b" }),
        hourMarks.map((m) =>
                h(
                          "div",
                  { key: m, className: "relative h-16 border-b text-right text-[10px] text-muted-foreground" },
                          h("span", { className: "absolute -top-2 right-1" }, formatTime(`${Math.floor(m / 60)}:${m % 60}`)),
                        ),
                          ),
      );

  return h(
        "div",
    { className: "space-y-4" },
        h(DateNav, { activeDate, setActiveDate }),
        techs.length === 0
          ? h("p", { className: "text-sm text-muted-foreground" }, "No service techs on the roster yet.")
          : h(
                      "div",
            { className: "overflow-x-auto rounded-2xl border" },
                      h("div", { className: "flex min-w-[640px]" }, timeColumn, columns),
                    ),
      );
}

function RoutesView({
    activeDate,
    setActiveDate,
    techs,
    dayAssignments,
    jobById,
    canManage,
}: {
    activeDate: string;
    setActiveDate: (d: string) => void;
    techs: ServiceMember[];
    dayAssignments: ServiceAssignment[];
    jobById: Map<string, ServiceJob>;
    canManage: boolean;
}) {
    const byTech = useMemo(() => {
          const map = new Map<string, ServiceAssignment[]>();
          for (const a of dayAssignments) {
                  if (!a.service_tech_id) continue;
                  const list = map.get(a.service_tech_id) ?? [];
                  list.push(a);
                  map.set(a.service_tech_id, list);
          }
          for (const list of map.values()) {
                  list.sort((a, b) => {
                            const ao = a.route_order ?? 999;
                            const bo = b.route_order ?? 999;
                            if (ao !== bo) return ao - bo;
                            return (toMinutes(a.scheduled_start_time) ?? 0) - (toMinutes(b.scheduled_start_time) ?? 0);
                  });
          }
          return map;
    }, [dayAssignments]);

  const cards = techs.map((tech) => {
        const stops = byTech.get(tech.id) ?? [];
        const mapStops = stops.map((a, i) => ({ id: a.job_id, lat: a.lat, lng: a.lng, label: jobById.get(a.job_id)?.job_number ?? a.job_number, order: i + 1 })).filter((s) => s.lat != null && s.lng != null) as { id: string; lat: number; lng: number; label: string; order: number }[];
        const stopItems = stops.map((a, i) => {
                const job = jobById.get(a.job_id);
                return h(
                          "li",
                  { key: a.job_id, className: "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm" },
                          h("span", { className: "inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold" }, String(i + 1)),
                          h("span", { className: JOB_BTN }, job?.job_number ?? a.job_number),
                          h("span", { className: "min-w-0 flex-1 truncate" }, job?.client_name ?? ""),
                          h("span", { className: "text-xs text-muted-foreground" }, formatTime(a.scheduled_start_time)),
                          canManage
                            ? h(
                                            "form",
                              { action: updateServiceRoute, className: "flex items-center gap-1" },
                                            h("input", { type: "hidden", name: "jobId", value: a.job_id }),
                                            h("input", {
                                                              type: "number",
                                                              name: "order",
                                                              defaultValue: a.route_order ?? i + 1,
                                                              className: "h-8 w-14 rounded-full border border-border bg-background px-2 text-center text-xs",
                                            }),
                                            h("button", { type: "submit", className: "text-xs text-primary underline-offset-2 hover:underline" }, "Set stop #"),
                                          )
                            : null,
                        );
        });
        return h(
                "section",
          { key: tech.id, className: "space-y-2 rounded-2xl border p-4" },
                h(
                          "div",
                  { className: "flex items-center justify-between gap-2" },
                          h("h2", { className: "font-heading text-base font-semibold" }, memberLabel(tech)),
                          ),
            h(ServiceRouteMap, { key: `${tech.id}-${activeDate}`, orgId: tech.org_id ?? "", techId: tech.id, techName: memberLabel(tech), stops: mapStops }),
                stops.length === 0
                  ? h("p", { className: "text-sm text-muted-foreground" }, "No stops scheduled for this date.")
                  : h("ol", { className: "space-y-2" }, stopItems),
              );
  });

  return h(
        "div",
    { className: "space-y-4" },
        h(DateNav, { activeDate, setActiveDate }),
        techs.length === 0
          ? h("p", { className: "text-sm text-muted-foreground" }, "No service techs on the roster yet.")
          : h("div", { className: "grid gap-4 lg:grid-cols-2" }, cards),
      );
}
