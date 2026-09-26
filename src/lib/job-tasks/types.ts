/** job_tasks isn't in the generated Supabase types yet — added by
* supabase/57_job_tasks.sql, run directly rather than via codegen. */
export type JobTask = {
  id: string;
  org_id: string;
  job_id: string;
  title: string;
  assigned_to: string | null;
  created_by: string | null;
  done_at: string | null;
  created_at: string;
};
