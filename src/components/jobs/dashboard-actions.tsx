"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FolderDown, MoreHorizontal, Plus, Printer, Upload } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { buildBackupCsv, buildInReviewCsv } from "@/lib/inventory/csv";
import { NewJobDialog } from "@/components/new-job-dialog";
import { PrintButton } from "@/components/print-button";
import { BulkJobForm } from "@/components/inventory/bulk-job-form";
import { CsvUploadForm } from "@/components/inventory/csv-upload-form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Job = Tables<"jobs">;

const REPORTS: [string, string][] = [
  ["jobs", "Job list"],
  ["daily", "Daily activity"],
  ["weekly", "Weekly activity"],
  ["monthly", "Monthly activity"],
  ["cycle", "Cycle times"],
  ["todo", "To-do list"],
  ["performance", "My performance"],
  ["roofing", "Roofing only"],
];

function download(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DashboardActions({ orgId, userId }: { orgId: string; userId: string }) {
  const router = useRouter();
  const [showBulk, setShowBulk] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  async function loadJobs(): Promise<Job[]> {
    const supabase = createClient();
    const { data } = await supabase.from("jobs").select("*").eq("org_id", orgId).order("updated_at", { ascending: false });
    return data ?? [];
  }

  return (
    <>
      <div className="flex items-center gap-2 print:hidden">
        <PrintButton label="Print master report" />
        <NewJobDialog />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setShowBulk(true)}>
              <Plus /> Add 10 jobs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowUpload(true)}>
              <Upload /> Upload spreadsheet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                const jobs = await loadJobs();
                download(buildBackupCsv(jobs), `permit-inventory-backup-${new Date().toISOString().slice(0, 10)}.csv`);
              }}
            >
              <Download /> Download backup
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const jobs = await loadJobs();
                download(buildInReviewCsv(jobs), `permits-in-review-${new Date().toISOString().slice(0, 10)}.csv`);
              }}
            >
              <FolderDown /> In-review list
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Reports</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {REPORTS.map(([value, label]) => (
                  <DropdownMenuItem key={value} onClick={() => router.push(`/inventory?report=${value}`)}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => window.print()}>
              <Printer /> Print report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <BulkJobForm
        open={showBulk}
        onOpenChange={setShowBulk}
        orgId={orgId}
        userId={userId}
        onCreated={() => router.refresh()}
      />
      <CsvUploadForm open={showUpload} onOpenChange={setShowUpload} orgId={orgId} userId={userId} onUploaded={() => router.refresh()} />
    </>
  );
}
