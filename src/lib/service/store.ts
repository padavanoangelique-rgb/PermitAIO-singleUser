import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

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

export type ServiceTicket = {
      id: string;
      job_id: string;
      job_number: string;
      service_tech_id: string | null;
      issue: string;
      photo_paths: string[] | null;
      submitted_at: string;
};

type Row = Record<string, unknown>;

type AnyFrom = {
      from: (t: string) => {
              select: (c: string) => {
                        eq: (a: string, b: string) => Promise<{ data: Row[] | null; error: { message: string } | null }> & {
                                    eq: (a: string, b: string) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
                        };
              };
              insert: (row: Row) => Promise<{ error: { message: string } | null }>;
              update: (row: Row) => {
                eq: (a: string, b: string) => Promise<{ error: { message: string } | null }>;
              };
      };
};

function raw(supabase: Db): AnyFrom {
      return supabase as unknown as AnyFrom;
}

async function findLatestTicketId(supabase: Db, orgId: string, jobId: string): Promise<string | null> {
      const res = await raw(supabase).from("service_tickets").select("id, created_at").eq("org_id", orgId).eq("job_id", jobId);
      if (res.error) return null;
      const rows = (res.data ?? []) as { id: string; created_at: string }[];
      if (rows.length === 0) return null;
      rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return rows[rows.length - 1].id;
}

const ASSIGNMENT_COLS =
      "job_id, job_number, service_tech_id, scheduled_date, scheduled_start_time, scheduled_end_time, status, priority, issue_description, requested_by_name, request_source, requested_date, route_order, lat, lng, created_at";

export async function loadAssignments(supabase: Db, orgId: string): Promise<ServiceAssignment[]> {
      const res = await raw(supabase).from("service_tickets").select(ASSIGNMENT_COLS).eq("org_id", orgId);
      if (res.error) return [];
      const rows = (res.data ?? []) as (ServiceAssignment & { created_at: string })[];
      rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return rows;
}

export async function saveAssignment(
      supabase: Db,
      orgId: string,
      userId: string,
      row: {
              job_id: string;
              job_number: string;
              service_tech_id?: string | null;
              scheduled_date?: string | null;
              scheduled_start_time?: string | null;
              scheduled_end_time?: string | null;
              status?: string;
              issue_description?: string;
              priority?: string;
              requested_by_name?: string | null;
              request_source?: string | null;
              assigned_by?: string;
      },
    ): Promise<string | null> {
      let status = row.status || "open";
      if (status === "open" && row.scheduled_date) status = "scheduled";
      if (!row.service_tech_id && status === "scheduled") status = "open";

  const now = new Date().toISOString();
      const patch: Row = {
              service_tech_id: row.service_tech_id ?? null,
              scheduled_date: row.scheduled_date ?? null,
              scheduled_start_time: row.scheduled_start_time ?? null,
              scheduled_end_time: row.scheduled_end_time ?? null,
              status,
              updated_at: now,
      };
      if (row.service_tech_id) patch.assigned_at = now;

  const ticketId = await findLatestTicketId(supabase, orgId, row.job_id);
      if (ticketId) {
              const { error } = await raw(supabase).from("service_tickets").update(patch).eq("id", ticketId);
              return error?.message ?? null;
      }
      const { error } = await raw(supabase).from("service_tickets").insert({
              org_id: orgId,
              job_id: row.job_id,
              job_number: row.job_number,
              issue_description: row.issue_description || "",
              priority: row.priority || "routine",
              requested_by: row.assigned_by || userId,
              requested_by_name: row.requested_by_name ?? null,
              request_source: row.request_source || "service",
              ...patch,
      });
      return error?.message ?? null;
}

export async function createServiceRequest(
      supabase: Db,
      orgId: string,
      userId: string,
      row: {
              job_id: string;
              job_number: string;
              issue_description: string;
              priority?: string;
              requested_by_name?: string | null;
              request_source?: string | null;
              requested_date?: string | null;
      },
    ): Promise<string | null> {
      const { error } = await raw(supabase).from("service_tickets").insert({
              org_id: orgId,
              job_id: row.job_id,
              job_number: row.job_number,
              issue_description: row.issue_description,
              priority: row.priority || "routine",
              requested_by: userId,
              requested_by_name: row.requested_by_name ?? null,
              request_source: row.request_source || "service",
              requested_date: row.requested_date ?? null,
              status: "open",
      });
      return error?.message ?? null;
}

export async function setRouteOrder(supabase: Db, orgId: string, jobId: string, order: number | null): Promise<string | null> {
      const ticketId = await findLatestTicketId(supabase, orgId, jobId);
      if (!ticketId) return "No service ticket found for that job.";
      const { error } = await raw(supabase).from("service_tickets").update({ route_order: order }).eq("id", ticketId);
      return error?.message ?? null;
}

export async function setStopLocation(supabase: Db, orgId: string, jobId: string, lat: number, lng: number): Promise<string | null> {
      const ticketId = await findLatestTicketId(supabase, orgId, jobId);
      if (!ticketId) return "No service ticket found for that job.";
      const { error } = await raw(supabase).from("service_tickets").update({ lat, lng }).eq("id", ticketId);
      return error?.message ?? null;
}

export async function loadTickets(supabase: Db, orgId: string, since?: string): Promise<ServiceTicket[]> {
      const res = await raw(supabase)
        .from("service_tickets")
        .select("id, job_id, job_number, service_tech_id, issue:issue_description, photo_paths, submitted_at:created_at")
        .eq("org_id", orgId);
      if (res.error) return [];
      let rows = (res.data ?? []) as unknown as ServiceTicket[];
      if (since) rows = rows.filter((t) => t.submitted_at >= since);
      return rows.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}

export async function saveTicket(
      supabase: Db,
      orgId: string,
      userId: string,
      row: { job_id: string; job_number: string; service_tech_id: string | null; issue: string; photo_paths: string[] },
    ): Promise<string | null> {
      const now = new Date().toISOString();
      const ticketId = await findLatestTicketId(supabase, orgId, row.job_id);
      if (ticketId) {
              const { error } = await raw(supabase)
                .from("service_tickets")
                .update({
                            tech_notes: row.issue,
                            photo_paths: row.photo_paths,
                            status: "completed",
                            completed_at: now,
                            closed_at: now,
                            updated_at: now,
                })
                .eq("id", ticketId);
              return error?.message ?? null;
      }
      const { error } = await raw(supabase).from("service_tickets").insert({
              org_id: orgId,
              job_id: row.job_id,
              job_number: row.job_number,
              service_tech_id: row.service_tech_id,
              issue_description: row.issue,
              photo_paths: row.photo_paths,
              requested_by: userId,
              status: "completed",
              completed_at: now,
              closed_at: now,
      });
      return error?.message ?? null;
}

export async function loadTicketPhotoPaths(supabase: Db, orgId: string, jobId: string): Promise<Set<string>> {
      const already = new Set<string>();
      const res = await raw(supabase).from("service_tickets").select("photo_paths").eq("org_id", orgId);
      if (res.error) return already;
      for (const r of (res.data ?? []) as { photo_paths?: string[] | null }[]) {
              for (const p of r.photo_paths ?? []) already.add(p);
      }
      return already;
}
