import { createAdminClient } from "@/lib/supabase/admin";
import { StatusView, type StatusPayload } from "@/components/sales/status-view";
import { hoaPlain, HOMEOWNER_STAGES, hoaEtaLabel, hoaStageIndex, permitEtaLabel, stageIndexFromJob } from "@/lib/sales/friendly-status";
import { contractorStampForOrg, stampFields } from "@/lib/sales/brand";

export const dynamic = "force-dynamic";

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 20) return <InvalidLink />;

  try {
    const admin = createAdminClient();
    const db = admin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (a: string, b: string) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
        };
        update: (row: Record<string, unknown>) => { eq: (a: string, b: string) => Promise<unknown> };
      };
    };

    const linkRes = await db.from("homeowner_links").select("job_id, token, enabled, view_count").eq("token", token).maybeSingle();
    const link = linkRes.data as { job_id: string; enabled: boolean; view_count: number } | null;
    if (!link) return <InvalidLink />;
    if (!link.enabled) return <PausedLink />;

    const jobRes = await admin
      .from("jobs")
      .select("id, org_id, job_number, client_name, address, city, permit_number, sub_status, stage, assigned_date, submitted_date, approved_date, ordered_date, material_eta")
      .eq("id", link.job_id)
      .maybeSingle();
    const job = jobRes.data;
    if (!job) return <InvalidLink />;

    const hoaRes = await admin
      .from("hoa_jobs")
      .select("status, assigned_date, date_submitted, date_approved")
      .eq("org_id", job.org_id)
      .eq("job_id", job.id)
      .maybeSingle();
    const hoa = hoaRes.data;

    void db.from("homeowner_links").update({
      last_viewed_at: new Date().toISOString(),
      view_count: (link.view_count ?? 0) + 1,
    }).eq("token", token);

    const idx = stageIndexFromJob(job.sub_status, job.stage);
    const stage = HOMEOWNER_STAGES[idx];
    const hoaCopy = hoaPlain(hoa?.status, !!hoa);
    const stamp = await contractorStampForOrg(admin, job.org_id);
    const status: StatusPayload = {
      jobNumber: job.job_number,
      clientName: job.client_name,
      address: [job.address, job.city].filter(Boolean).join(", "),
      permitNumber: job.permit_number,
      permitTitle: stage.title,
      permitDescription: stage.description,
      permitNext: stage.next,
      stageIndex: idx,
      permitAssigned: job.assigned_date,
      permitSubmitted: job.submitted_date,
      permitApproved: job.approved_date,
      permitTech: "",
      hoaTitle: hoaCopy.title,
      hoaDetail: hoaCopy.detail,
      hoaAssigned: hoa?.assigned_date ?? null,
      hoaSubmitted: hoa?.date_submitted ?? null,
      hoaApproved: hoa?.date_approved ?? null,
      hoaTech: "",
      orderedDate: job.ordered_date,
      materialEta: job.material_eta,
      permitEta: permitEtaLabel(job.submitted_date, /approved|complete/i.test(job.sub_status ?? "")),
      hoaEta: hoaEtaLabel(hoa?.date_submitted ?? null, hoaCopy.approved, !!hoa),
      hoaStageIndex: hoaStageIndex(hoa?.status, !!hoa),
      ...stampFields(stamp),
    };

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b px-4 py-5 text-center">
          {stamp.logoUrl ? (
            <img src={stamp.logoUrl} alt={stamp.name} className="mx-auto mb-2 h-12 w-auto object-contain" />
          ) : null}
          <p className="font-heading text-lg font-semibold">{stamp.name}</p>
          <p className="text-xs text-muted-foreground">Permit status for your project</p>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-10">
          <StatusView data={status} audience="homeowner" />
          <p className="mt-10 text-center text-xs text-muted-foreground">
            This page is from {stamp.name}. Powered by PermitAIO. It does not show office notes.
          </p>
        </main>
      </div>
    );
  } catch (err) {
    console.error("track page", err);
    return <InvalidLink />;
  }
}

function InvalidLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-3xl">This link isn’t valid</h1>
        <p className="mt-3 text-muted-foreground">It may have been typed incorrectly. Ask your contractor for a new status link.</p>
      </div>
    </div>
  );
}

function PausedLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-3xl">Sharing is paused</h1>
        <p className="mt-3 text-muted-foreground">Please reach out to your contractor for the latest status.</p>
      </div>
    </div>
  );
}
