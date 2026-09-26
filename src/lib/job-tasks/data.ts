import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { JobTask } from "./types";

function jobTasksTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return (supabase as unknown as { from: (t: string) => any }).from("job_tasks");
}

/** Tasks for one job, newest first. */
export async function getJobTasks(jobId: string): Promise<JobTask[]> {
  const supabase = await createClient();
  const { data } = await jobTasksTable(supabase)
  .select("*")
  .eq("job_id", jobId)
  .order("created_at", { ascending: false });
  return (data ?? []) as JobTask[];
}
