import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { openingsForJob } from "@/lib/warehouse/openings";
import { WarehouseBoard, type WarehouseCheckin, type WarehouseJobRow } from "./warehouse-board";

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ mail?: string; job?: string }>;
}) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const params = await searchParams;
  const lookup = (params.job ?? "").trim();

  let notifyEmail = "";
  let tableNote = "";
  let found: WarehouseJobRow | null = null;
  let notFound = false;

  try {
    const db = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> & {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
            ilike: (a: string, b: string) => {
              limit: (n: number) => Promise<{ data: unknown[] | null }>;
            };
          };
        };
      };
    };
    const settings = await db.from("warehouse_settings").select("notify_email").eq("org_id", activeOrg.id);
    notifyEmail = ((settings.data ?? [])[0] as { notify_email?: string } | undefined)?.notify_email ?? "";
    if (settings.error) tableNote = settings.error.message;

    if (lookup) {
      const exact = await supabase
        .from("jobs")
        .select("id, job_number, client_name, address, city, permit_number, sub_status, permit_tech")
        .eq("org_id", activeOrg.id)
        .eq("job_number", lookup)
        .maybeSingle();
      let job = exact.data;
      if (!job) {
        const fuzzy = await supabase
          .from("jobs")
          .select("id, job_number, client_name, address, city, permit_number, sub_status, permit_tech")
          .eq("org_id", activeOrg.id)
          .ilike("job_number", `${lookup}%`)
          .limit(1)
          .maybeSingle();
        job = fuzzy.data;
      }
      if (!job) {
        notFound = true;
      } else {
        const plan = await supabase
          .from("floor_plans")
          .select("plan_data")
          .eq("org_id", activeOrg.id)
          .eq("job_id", job.id)
          .maybeSingle();

        let manualWindows = 0;
        let manualDoors = 0;
        let ready = false;
        const withCounts = await db
          .from("warehouse_jobs")
          .select("job_id, ready_for_schedule_at, manual_windows, manual_doors")
          .eq("org_id", activeOrg.id);
        const wj = withCounts.error
          ? await db.from("warehouse_jobs").select("job_id, ready_for_schedule_at").eq("org_id", activeOrg.id)
          : withCounts;
        const row = ((wj.data ?? []) as {
          job_id: string;
          ready_for_schedule_at: string | null;
          manual_windows?: number | null;
          manual_doors?: number | null;
        }[]).find((r) => r.job_id === job.id);
        if (row) {
          ready = !!row.ready_for_schedule_at;
          manualWindows = row.manual_windows ?? 0;
          manualDoors = row.manual_doors ?? 0;
        }

        const lines = await db
          .from("warehouse_checkins")
          .select("job_id, opening_key, received_at, received_by, broken, note, photo_path, photo_name")
          .eq("org_id", activeOrg.id);
        const checkins = ((lines.data ?? []) as (WarehouseCheckin & { job_id: string })[]).filter((c) => c.job_id === job.id);

        found = {
          id: job.id,
          job_number: job.job_number,
          client_name: job.client_name,
          address: job.address,
          city: job.city,
          permit_number: job.permit_number,
          sub_status: job.sub_status ?? "",
          permit_tech: job.permit_tech ?? "",
          ready,
          hasFloorPlan: openingsForJob(plan.data?.plan_data, 0, 0).length > 0,
          manualWindows,
          manualDoors,
          openings: openingsForJob(plan.data?.plan_data, manualWindows, manualDoors),
          checkins,
        };
      }
    }
  } catch (err) {
    tableNote = err instanceof Error ? err.message : "Run supabase/34_warehouse.sql in the database first.";
  }

  return (
    <WarehouseBoard
      job={found}
      lookup={lookup}
      notFound={notFound}
      mail={params.mail}
      tableNote={tableNote}
    />
  );
}
