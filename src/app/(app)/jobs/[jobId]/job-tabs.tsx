"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { SingleJobInventoryPanel } from "@/components/inventory/single-job-panel";
import { SingleJobHoaPanel } from "@/components/hoa/single-job-hoa-panel";
import { JobFormsPanel } from "@/components/forms/job-forms-panel";
import { JobRequirementsFormsPanel } from "@/components/requirements-forms/job-requirements-forms-panel";
import { JobNoaPanel } from "@/components/noa/job-noa-panel";
import { JobPermitPackagePanel } from "@/components/permit-package/job-permit-package-panel";
import { JobDocumentsPanel } from "@/components/documents/job-documents-panel";
import { RoofingDetailsPanel } from "@/components/roofing/roofing-details-panel";
import { JobEmailsPanel } from "@/components/jobs/job-emails-panel"; import { JobOverview } from "@/components/jobs/job-overview";
import { JobTasksPanel } from "@/components/jobs/job-tasks-panel";
import type { JobTask } from "@/lib/job-tasks/types";
import type { Teammate } from "@/lib/notifications/compose-actions";
import {
  LayoutGrid,
  Ruler,
  FileText,
  ShieldCheck,
  PackageCheck,
  Boxes,
  Landmark,
  FolderOpen,
  MessageSquare,
  HardHat,
  ClipboardList, Mail,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { formatDistanceToNow } from "date-fns";
import { isRoofingTrade } from "@/lib/jobs/trade";
import { NO_HOA_TECH } from "@/lib/hoa/constants";
import { useTechLabel } from "@/components/tech-slots-provider";
import {
  hoaPlain,
  HOMEOWNER_STAGES,
  hoaEtaLabel,
  hoaStageIndex,
  permitEtaLabel,
  stageIndexFromJob,
} from "@/lib/sales/friendly-status";

type Job = Tables<"jobs">;
type Activity = Tables<"job_activity">;

// Every TabsContent value below (the "floor-plans" trigger navigates to its
// own page instead of rendering TabsContent, so it's intentionally excluded).
const TAB_VALUES = [
  "overview",
  "roofing-details",
  "requirements",
  "forms",
  "noa",
  "package",
  "inventory",
  "hoa",
  "documents", "emails",
  "activity",
  ] as const;
type TabValue = (typeof TAB_VALUES)[number];

export function JobTabs({
  job,
  activity,
  tasks,
  teammates,
  currentUserId,
  orgName,
  shareCard,
  hoaSummary,
}: {
  job: Job;
  activity: Activity[];
  tasks: JobTask[];
  teammates: Teammate[];
  currentUserId: string;
  orgName: string;
  shareCard?: ReactNode;
  hoaSummary?: {
  community: string | null;
  status: string | null;
  submitted: string | null;
  approved: string | null;
  assignedTo: string | null;
  assigned: string | null;
  };
}) {
  const isRoofing = isRoofingTrade(job.trade_type);
  const { permitLabel, hoaLabel } = useTechLabel();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

// Tab state lives in the URL (?tab=forms) so reloading or sharing a link
// to a specific tab lands on that tab instead of always resetting to
// Overview.
const requestedTab = searchParams.get("tab");
  const activeTab: TabValue = useMemo(() => {
    if (
      requestedTab &&
      (TAB_VALUES as readonly string[]).includes(requestedTab) &&
      (requestedTab !== "roofing-details" || isRoofing)
      ) {
      return requestedTab as TabValue;
    }
    return "overview";
  }, [requestedTab, isRoofing]);

const handleTabChange = useCallback(
  (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  },
  [pathname, router, searchParams],
  );

const timeline = useMemo(() => {
  const hasHoa = job.hoa_tech !== NO_HOA_TECH;
  const idx = stageIndexFromJob(job.sub_status, job.stage);
  const hoaCopy = hoaPlain(hoaSummary?.status, hasHoa);
  return {
    permitTitle: HOMEOWNER_STAGES[idx]?.title ?? job.stage,
    permitEta: permitEtaLabel(
      job.submitted_date,
      /approved|complete/i.test(job.sub_status ?? ""),
      ),
    stageIndex: idx,
    permitAssigned: job.assigned_date,
    permitSubmitted: job.submitted_date,
    permitApproved: job.approved_date,
    permitNumber: job.permit_number,
    permitTech: permitLabel(job.permit_tech) || "Unassigned",
    hoaTitle: hoaCopy.title,
    hoaEta: hoaEtaLabel(hoaSummary?.submitted ?? null, hoaCopy.approved, hasHoa),
    hoaStageIndex: hoaStageIndex(hoaSummary?.status, hasHoa),
    hoaAssigned: hoaSummary?.assigned ?? null,
    hoaSubmitted: hoaSummary?.submitted ?? null,
    hoaApproved: hoaSummary?.approved ?? null,
    hoaTech: hoaLabel(job.hoa_tech || hoaSummary?.assignedTo) || "Unassigned",
    orderedDate: job.ordered_date,
    materialEta: job.material_eta,
  };
}, [job, hoaSummary, permitLabel, hoaLabel]);

return (
  <Tabs value={activeTab} onValueChange={handleTabChange}>
<TabsList className="flex h-auto gap-1 overflow-x-auto bg-transparent p-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-start sm:overflow-visible">
    <TabsTrigger value="overview" className="flex-none gap-1.5">
    <LayoutGrid className="h-3.5 w-3.5" /> Overview
    </TabsTrigger>
      {isRoofing ? (
    <TabsTrigger value="roofing-details" className="flex-none gap-1.5">
    <HardHat className="h-3.5 w-3.5" /> Roofing Details
    </TabsTrigger>
    ) : (
    <TabsTrigger value="floor-plans" asChild className="flex-none gap-1.5">
    <Link href={`/jobs/${job.id}/floor-plan`}>
    <Ruler className="h-3.5 w-3.5" /> Floor Plans
    </Link>
    </TabsTrigger>
    )}
    <TabsTrigger value="requirements" className="flex-none gap-1.5">
    <ClipboardList className="h-3.5 w-3.5" /> Requirements & Forms
    </TabsTrigger>
    <TabsTrigger value="forms" className="flex-none gap-1.5">
    <FileText className="h-3.5 w-3.5" /> Forms Generator
    </TabsTrigger>
    <TabsTrigger value="noa" className="flex-none gap-1.5">
    <ShieldCheck className="h-3.5 w-3.5" /> NOA Downloader
    </TabsTrigger>
    <TabsTrigger value="package" className="flex-none gap-1.5">
    <PackageCheck className="h-3.5 w-3.5" /> Permit Package
    </TabsTrigger>
    <TabsTrigger value="inventory" className="flex-none gap-1.5">
    <Boxes className="h-3.5 w-3.5" /> Permit Inventory
    </TabsTrigger>
    <TabsTrigger value="hoa" className="flex-none gap-1.5">
    <Landmark className="h-3.5 w-3.5" /> HOA Tracker
    </TabsTrigger>
    <TabsTrigger value="documents" className="flex-none gap-1.5">
    <FolderOpen className="h-3.5 w-3.5" /> Documents
    </TabsTrigger>
    <TabsTrigger value="emails" className="flex-none gap-1.5"><Mail className="h-3.5 w-3.5" /> Emails</TabsTrigger> <TabsTrigger value="activity" className="flex-none gap-1.5">
    <MessageSquare className="h-3.5 w-3.5" /> Activity & Notes
    </TabsTrigger>
    </TabsList>
  
  <TabsContent value="overview" className="mt-4">
  <JobOverview
    jobId={job.id}
    notes={job.notes}
    isRoofing={isRoofing}
    timeline={timeline}
    meta={{
      folio: job.folio_number,
      city: job.city,
      jurisdiction: job.jurisdiction,
      noc: job.noc_status,
      orderedDate: job.ordered_date,
      materialEta: job.material_eta,
    }}
    shareCard={shareCard}
    />
  </TabsContent>
  
    {isRoofing && (
    <TabsContent value="roofing-details" className="mt-4">
    <RoofingDetailsPanel job={job} />
    </TabsContent>
  )}
  
  <TabsContent value="requirements" className="mt-4">
  <JobRequirementsFormsPanel job={job} />
  </TabsContent>
  
  <TabsContent value="forms" className="mt-4">
  <JobFormsPanel job={job} />
  </TabsContent>
  
  <TabsContent value="noa" className="mt-4">
  <JobNoaPanel job={job} />
  </TabsContent>
  
  <TabsContent value="package" className="mt-4">
  <JobPermitPackagePanel job={job} />
  </TabsContent>
  
  <TabsContent value="inventory" className="mt-4">
  <SingleJobInventoryPanel job={job} orgName={orgName} />
  </TabsContent>
  
  <TabsContent value="hoa" className="mt-4">
  <SingleJobHoaPanel job={job} orgName={orgName} />
  </TabsContent>
  
  <TabsContent value="documents" className="mt-4">
  <JobDocumentsPanel job={job} />
  </TabsContent>
  
  <TabsContent value="emails" className="mt-4"><JobEmailsPanel job={job} orgName={orgName} /></TabsContent> <TabsContent value="activity" className="mt-4 space-y-6">
  <section className="px-1 py-2">
  <JobTasksPanel
    jobId={job.id}
    currentUserId={currentUserId}
    initialTasks={tasks}
    teammates={teammates}
    />
  </section>
  
  <section className="space-y-3 px-1 py-2">
  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity & notes</h2>
    {activity.length === 0 ? (
    <p className="text-sm text-muted-foreground">No activity yet.</p>
    ) : (
    <ul className="space-y-3">
      {activity.map((entry) => (
      <li key={entry.id} className="pb-3 text-sm">
      <p>{entry.message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(entry.created_at), {
        addSuffix: true,
      })}
      </p>
      </li>
      ))}
    </ul>
  )}
  </section>
  </TabsContent>
  </Tabs>
  );
}
