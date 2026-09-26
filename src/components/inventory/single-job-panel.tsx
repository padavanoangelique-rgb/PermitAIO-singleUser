"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tables, TablesUpdate } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { JURISDICTIONS } from "@/lib/inventory/constants";
import { JobRow } from "./job-row";
import { JobRowHeader } from "./job-row-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type TechNameMap } from "@/lib/tech-labels";

type Job = Tables<"jobs">;
type JobFile = Tables<"job_files">;

export function SingleJobInventoryPanel({ job, orgName }: { job: Job; orgName: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(job);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [techNames, setTechNames] = useState<TechNameMap>({});
  const jurisdictions = useMemo(() => {
    const map = new Map(JURISDICTIONS.map((jurisdiction) => [jurisdiction.toLowerCase(), jurisdiction]));
    if (current.jurisdiction && !map.has(current.jurisdiction.toLowerCase())) map.set(current.jurisdiction.toLowerCase(), current.jurisdiction);
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [current.jurisdiction]);

  async function updateJob(patch: TablesUpdate<"jobs">, force = false) {
    let realChanges = patch;
    if (!force) {
      realChanges = {};
      for (const [key, next] of Object.entries(patch)) {
        if ((next ?? null) !== ((current as Record<string, unknown>)[key] ?? null)) (realChanges as Record<string, unknown>)[key] = next;
      }
      if (!Object.keys(realChanges).length) return;
    }
    if (realChanges.sub_status) {
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (realChanges.sub_status === "In Review" && !current.submitted_date && realChanges.submitted_date === undefined) realChanges.submitted_date = todayIso;
      if ((realChanges.sub_status === "Approved" || realChanges.sub_status === "Approved and Printed") && !current.approved_date && realChanges.approved_date === undefined) realChanges.approved_date = todayIso;
    }
    const previous = current;
    setCurrent({ ...current, ...realChanges });
    const supabase = createClient();
    const { error } = await supabase.from("jobs").update(realChanges).eq("id", current.id).eq("org_id", current.org_id);
    if (error) { setCurrent(previous); alert(`Couldn't save that change: ${error.message}`); }
  }
  const loadFiles = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("job_files").select("*").eq("org_id", current.org_id).eq("job_id", current.id).order("uploaded_at", { ascending: false });
    setFiles(data ?? []);
  }, [current.id, current.org_id]);
  async function uploadFile(file: File) {
    const supabase = createClient(), safeName = file.name.replace(/[^\w.\-]/g, "_"), path = `${current.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
    if (uploadError) return alert(`Couldn't upload that file: ${uploadError.message}`);
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("job_files").insert({ org_id: current.org_id, job_id: current.id, file_name: file.name, storage_path: path, size_bytes: file.size, uploaded_by: auth.user?.id ?? null, category: "permit-inventory" });
    if (insertError) { await supabase.storage.from("job-files").remove([path]); return alert(`Couldn't save that file: ${insertError.message}`); }
    await loadFiles();
  }
  async function downloadFile(file: JobFile) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("job-files").createSignedUrl(file.storage_path, 60);
    if (error || !data) return alert(`Couldn't open that file: ${error?.message ?? "unknown error"}`);
    window.open(data.signedUrl, "_blank");
  }
  async function deleteFile(file: JobFile) {
    const supabase = createClient();
    const { error } = await supabase.from("job_files").delete().eq("id", file.id).eq("org_id", current.org_id);
    if (error) return alert(`Couldn't remove that file: ${error.message}`);
    await supabase.storage.from("job-files").remove([file.storage_path]);
    await loadFiles();
  }
  async function deleteJob() {
    const supabase = createClient();
    const { error } = await supabase.from("jobs").delete().eq("id", current.id).eq("org_id", current.org_id);
    if (error) return alert(`Couldn't delete that job: ${error.message}`);
    router.push("/inventory");
  }

  useEffect(() => { void loadFiles(); }, [loadFiles]);
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("org_tech_names")
      .select("slot, display_name")
      .eq("org_id", current.org_id)
      .eq("kind", "permit")
      .then(({ data }) => {
        if (!data) return;
        const map: TechNameMap = {};
        for (const row of data) map[row.slot] = row.display_name;
        setTechNames(map);
      });
  }, [current.org_id]);

  return (
    <div className="space-y-4">
      <Card className="gap-2 py-4">
        <CardHeader className="flex-row items-center justify-between px-5 py-0">
          <CardTitle className="text-base font-heading">Permit Inventory</CardTitle>
          <Button asChild variant="outline" size="sm"><Link href="/inventory">View in Permit Inventory board</Link></Button>
        </CardHeader>
        <CardContent className="px-5 text-sm text-muted-foreground">Live permit details for {orgName}. Changes save automatically.</CardContent>
      </Card>
      <JobRowHeader />
      <JobRow job={current} onUpdate={updateJob} onDelete={deleteJob} jurisdictionOptions={jurisdictions} files={files} onUploadFile={uploadFile} onDownloadFile={downloadFile} onDeleteFile={deleteFile} techNames={techNames} defaultCollapsed={false} />
    </div>
  );
}
