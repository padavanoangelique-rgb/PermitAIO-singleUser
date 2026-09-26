"use client";

import { Search, Briefcase } from "lucide-react";
import { currency } from "@/lib/inventory/constants";
import { KpiCard, type KpiTone } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addInstallMember,
  addJobToInstallBoard,
  assignAccountManager,
  assignInstallJob,
} from "./actions";
import type { InstallAssignment, InstallJob, InstallMember } from "./install-dashboard";
import { BTN_BLUE } from "./install-ui";

type Lane = "need_schedule" | "need_am" | "need_crew" | "scheduled" | "need_check" | "passed" | "failed";
type Filter = Lane | "on_board" | null;

const ROLE_LABEL: Record<string, string> = {
  install_manager: "Install manager",
  account_manager: "Account manager",
  project_manager: "Project manager",
  installer: "Installer",
};

const SELECT = "mt-1 block h-11 w-full rounded-full border border-input bg-background px-3 text-sm text-foreground";

function memberLabel(m?: InstallMember) {
  if (!m) return "Unassigned";
  const name = m.display_name?.trim();
  const company = m.company_name?.trim();
  if (name && company) return `${name} · ${company}`;
  return name || company || m.email;
}

export function BoardTab({
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
  memberById,
  assignmentByJob,
  accountManagers,
  pms,
  installers,
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
  assignments?: InstallAssignment[];
  memberById: Map<string, InstallMember>;
  grouped?: { key: Lane; label: string; rows: InstallJob[] }[];
  assignmentByJob: Map<string, InstallAssignment>;
  accountManagers: InstallMember[];
  pms: InstallMember[];
  installers: InstallMember[];
  canCheck?: boolean;
  readyIds?: Set<string>;
  openId?: string | null;
  setOpenId: (id: string | null) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Board</h1>
        <p className="text-sm text-muted-foreground">Signed in as {myTitle}. Assign installer and PM on each job.</p>
      </div>
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${showMoney ? "xl:grid-cols-9" : "lg:grid-cols-8"}`}>
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
      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="py-0">
            <CardHeader className="pt-4">
              <CardTitle className="text-base">Add a job to the board</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
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
                <button className={BTN_BLUE} type="submit">Add</button>
              </form>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardHeader className="pt-4">
              <CardTitle className="text-base">Invite crew</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <form action={addInstallMember} className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs sm:col-span-2">Email<input name="email" type="email" required className={SELECT} /></label>
                <label className="text-xs">Role
                  <select name="role" className={SELECT} defaultValue="installer">
                    <option value="account_manager">Account manager</option>
                    <option value="project_manager">Project manager</option>
                    <option value="installer">Installer</option>
                  </select>
                </label>
                <label className="text-xs">Name<input name="displayName" className={SELECT} /></label>
                <label className="text-xs sm:col-span-2">Company<input name="companyName" className={SELECT} /></label>
                <button className={`${BTN_BLUE} sm:col-span-2`} type="submit">Send invite</button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
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
      {showMoney ? (
        <Card className="py-0">
          <CardHeader className="pt-4"><CardTitle className="text-base">Money out by who</CardTitle></CardHeader>
          <CardContent className="grid gap-4 pb-6 lg:grid-cols-3">
            {(["account_manager", "project_manager", "installer"] as const).map((role) => (
              <div key={role}>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[role]}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {moneyBy(role).length === 0 ? <li className="text-muted-foreground">None yet</li> : moneyBy(role).map(({ member, count, value }) => (
                    <li key={member.id} className="flex justify-between gap-2">
                      <span>{memberLabel(member)} <span className="text-muted-foreground">({count})</span></span>
                      <span className="font-medium">{currency(value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Installer</th>
              <th className="px-4 py-3 font-medium">PM</th>
              <th className="px-4 py-3 font-medium">AM</th>
              <th className="px-4 py-3 font-medium">Inspection</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-muted-foreground">No install jobs match this view.</td></tr>
            ) : jobs.map((job) => {
              const a = assignmentByJob.get(job.id);
              return (
                <tr key={job.id} className="border-t">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setOpenId(job.id)} className="text-left">
                      <span className="font-medium tabular-nums text-primary">{job.job_number}</span>
                      <span className="block text-xs text-muted-foreground">{job.client_name}{job.city ? ` · ${job.city}` : ""}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <form action={assignInstallJob}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="jobNumber" value={job.job_number} />
                        <input type="hidden" name="pmId" value={a?.pm_id ?? ""} />
                        <input type="hidden" name="inspectionDate" value={a?.inspection_date ?? ""} />
                        <input type="hidden" name="inspectionResult" value={a?.inspection_result ?? ""} />
                        <select name="installerId" defaultValue={a?.installer_id ?? ""} className="h-10 w-full min-w-[10rem] rounded-full border border-input bg-background px-3" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                          <option value="">Unassigned</option>
                          {installers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
                        </select>
                      </form>
                    ) : memberLabel(a?.installer_id ? memberById.get(a.installer_id) : undefined)}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <form action={assignInstallJob}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="jobNumber" value={job.job_number} />
                        <input type="hidden" name="installerId" value={a?.installer_id ?? ""} />
                        <input type="hidden" name="inspectionDate" value={a?.inspection_date ?? ""} />
                        <input type="hidden" name="inspectionResult" value={a?.inspection_result ?? ""} />
                        <select name="pmId" defaultValue={a?.pm_id ?? ""} className="h-10 w-full min-w-[10rem] rounded-full border border-input bg-background px-3" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                          <option value="">Unassigned</option>
                          {pms.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
                        </select>
                      </form>
                    ) : memberLabel(a?.pm_id ? memberById.get(a.pm_id) : undefined)}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <form action={assignAccountManager}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="jobNumber" value={job.job_number} />
                        <select name="accountManagerId" defaultValue={a?.account_manager_id ?? ""} className="h-10 w-full min-w-[10rem] rounded-full border border-input bg-background px-3" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                          <option value="">Unassigned</option>
                          {accountManagers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
                        </select>
                      </form>
                    ) : memberLabel(a?.account_manager_id ? memberById.get(a.account_manager_id) : undefined)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a?.inspection_result === "passed" ? "Passed" : a?.inspection_result === "failed" ? "Failed" : a?.inspection_date ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
