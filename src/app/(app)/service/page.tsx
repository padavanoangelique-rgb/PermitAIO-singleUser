import { createElement as h } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { cleanTableNote } from "@/lib/db/table-note";
import { ServiceDashboard, type ServiceAssignment, type ServiceJob, type ServiceMember } from "./service-dashboard";
import { ServiceTechApp, type ServiceTicket } from "./service-tech-app";
import { ServiceRequestForm } from "./service-request-form";
import { RolePicker } from "./role-picker";
import { loadAssignments, loadTickets } from "@/lib/service/store";
import { setStopLocation } from "@/lib/service/store";
import { geocodeAddress } from "@/lib/service/geocode";

export default async function ServicePage({
    searchParams,
}: {
    searchParams: Promise<{ mail?: string; app?: string; source?: string }>;
}) {
    const user = await requireUser();
    const { activeOrg, role } = await requireActiveOrg();
    const admin = await isPlatformAdmin();
    const supabase = await createClient();
    const params = await searchParams;
    const orgManager = role === "owner" || role === "admin" || role === "manager";

  if (params.app === "request") {
        return h(ServiceRequestForm, {
                mail: params.mail,
                defaultSource: params.source,
                next: `/service?app=request${params.source ? `&source=${params.source}` : ""}`,
        });
  }

  // Supabase returns at most 1,000 rows per request, so page through every job. Otherwise a shop with
  // more than 1,000 jobs never sees the older ones in the service search or the "add a job" list.
  const jobs: ServiceJob[] = [];
  for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from("jobs")
        .select("id, job_number, client_name, address, city, trade_type, permit_number")
        .eq("org_id", activeOrg.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (!page || page.length === 0) break;
      jobs.push(...(page as ServiceJob[]));
      if (page.length < 1000) break;
  }

  let serviceMembers: ServiceMember[] = [];
    let assignments: ServiceAssignment[] = [];
    let tickets: ServiceTicket[] = [];
    let tableNote = "";
    try {
          const db = supabase as unknown as {
                  from: (t: string) => {
                            select: (c: string) => {
                                        eq: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> & {
                                                      order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
                                        };
                            };
                  };
          };
          const roster = await db
            .from("service_members")
            .select("id, email, role, user_id, display_name, company_name, org_id")
            .eq("org_id", activeOrg.id);
          if (roster.error) {
                  tableNote = cleanTableNote(roster.error.message);
          } else {
                  serviceMembers = (roster.data ?? []) as ServiceMember[];
          }
          assignments = await loadAssignments(supabase, activeOrg.id);
          tickets = await loadTickets(supabase, activeOrg.id);
    } catch (err) {
          tableNote = cleanTableNote(err instanceof Error ? err.message : "");
    }

    const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));
    const toGeocode = assignments.filter((a) => a.scheduled_date && a.lat == null).slice(0, 6);
    const found = new Map<string, { lat: number; lng: number }>();
    await Promise.all(toGeocode.map(async (a) => { try { const j = jobById.get(a.job_id); const addr = [j?.address, j?.city].filter(Boolean).join(", "); if (!addr) return; const pt = (await geocodeAddress(addr)) ?? (await geocodeAddress(`${addr}, FL`)); if (!pt) return; found.set(a.job_id, pt); await setStopLocation(supabase, activeOrg.id, a.job_id, pt.lat, pt.lng); } catch { /* leave the stop unplotted */ } }));
    if (found.size > 0) assignments = assignments.map((a) => { const pt = found.get(a.job_id); return pt ? { ...a, lat: pt.lat, lng: pt.lng } : a; });
  const myEmail = (user.email ?? "").toLowerCase();
    const myRoles = serviceMembers.filter((m) => m.email.toLowerCase() === myEmail || m.user_id === user.id);
    const catalog = (jobs ?? []) as ServiceJob[];
    const onBoard = new Set(assignments.map((a) => a.job_id));
    const boardJobs = catalog.filter((j) => onBoard.has(j.id));
    const addable = catalog.filter((job) => !onBoard.has(job.id));
    const assignmentByJob = new Map(assignments.map((a) => [a.job_id, a]));

  const canManagerView = orgManager || admin || myRoles.some((m) => m.role === "service_manager");
    const canTechView = myRoles.some((m) => m.role === "service_tech");

  const available: { key: string; label: string }[] = [];
    if (canManagerView) available.push({ key: "manager", label: "Service manager" });
    if (canTechView) available.push({ key: "tech", label: "Service tech" });

  const requestedApp = params.app ?? "";
    let appKey: string;
    if (requestedApp && available.some((a) => a.key === requestedApp)) {
          appKey = requestedApp;
    } else if (available.length <= 1) {
          appKey = available[0]?.key ?? "manager";
    } else {
          appKey = "";
    }

  if (appKey === "") {
        return h(RolePicker, { options: available, mail: params.mail });
  }

  if (appKey === "tech") {
        const myTechIds = new Set(myRoles.filter((m) => m.role === "service_tech").map((m) => m.id));
        const techJobs = boardJobs.filter((job) => {
                const a = assignmentByJob.get(job.id);
                return a?.service_tech_id ? myTechIds.has(a.service_tech_id) : false;
        });
        const techId = [...myTechIds][0] ?? null;
        return h(ServiceTechApp, {
                jobs: techJobs,
                mail: params.mail,
                techName: user.email ?? "Service tech",
                orgId: activeOrg.id,
                techId,
                tickets: tickets.filter((t) => (t.service_tech_id ? myTechIds.has(t.service_tech_id) : true)),
        });
  }

  return h(ServiceDashboard, {
        jobs: boardJobs,
        assignments,
        members: serviceMembers,
        addable,
        mail: params.mail,
        tableNote,
        signedInName: user.email ?? "Service manager",
        orgName: activeOrg.name,
        canManage: canManagerView,
        tickets,
  });
}
