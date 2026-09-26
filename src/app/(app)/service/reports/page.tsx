import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { PILL } from "@/lib/ui/chrome";
import { FILL_BLUE } from "@/lib/ui/fills";
import type { ServiceJob, ServiceMember } from "../service-dashboard";
import type { ServiceTicket } from "../service-tech-app";
import { PrintButton } from "./print-button";
import { loadTickets } from "@/lib/service/store";

function nyDay(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function startOfRange(range: "day" | "week") {
  const now = new Date();
  if (range === "day") {
    const ymd = nyDay(now);
    return new Date(`${ymd}T00:00:00-04:00`);
  }
  const t = now.getTime() - 6 * 24 * 60 * 60 * 1000;
  const ymd = nyDay(new Date(t));
  return new Date(`${ymd}T00:00:00-04:00`);
}

export default async function ServiceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const params = await searchParams;
  const range = params.range === "week" ? "week" : "day";
  const since = startOfRange(range);

  const supabase = await createClient();
  const anyDb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> & {
          gte: (c: string, d: string) => {
            order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
    storage: { from: (b: string) => { createSignedUrl: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null }> } };
  };

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, job_number, client_name, address, city, trade_type, permit_number")
    .eq("org_id", activeOrg.id);

  const roster = await anyDb.from("service_members").select("id, email, role, user_id, display_name, company_name").eq("org_id", activeOrg.id);
  const tickets = await loadTickets(supabase, activeOrg.id, since.toISOString());
  const members = ((roster as { data?: ServiceMember[] }).data ?? []) as ServiceMember[];
  const tableNote = "";
  const jobById = new Map(((jobs ?? []) as ServiceJob[]).map((j) => [j.id, j]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const withPhotos = await Promise.all(
    tickets.map(async (t) => {
      const urls: { path: string; url: string }[] = [];
      for (const path of t.photo_paths ?? []) {
        const signed = await anyDb.storage.from("job-files").createSignedUrl(path, 60 * 60);
        if (signed.data?.signedUrl) urls.push({ path, url: signed.data.signedUrl });
      }
      return { ...t, urls };
    }),
  );

  const label = range === "week" ? "Weekly" : "Daily";
  const when = since.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/service" className="text-sm text-muted-foreground hover:text-foreground">
          ← Service Dashboard
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href="/service/reports?range=day" className={`${PILL} ${range === "day" ? FILL_BLUE : "bg-muted"}`}>
            Daily
          </Link>
          <Link href="/service/reports?range=week" className={`${PILL} ${range === "week" ? FILL_BLUE : "bg-muted"}`}>
            Weekly
          </Link>
          <PrintButton />
        </div>
      </div>

      <header className="border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">PermitAIO · Service</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
          {label} service tickets
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeOrg.name} · since {when} · {withPhotos.length} ticket{withPhotos.length === 1 ? "" : "s"}
        </p>
      </header>

      {tableNote ? <p className="text-sm text-amber-700 print:hidden">{tableNote}</p> : null}

      {withPhotos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets in this window yet.</p>
      ) : (
        withPhotos.map((t) => {
          const job = jobById.get(t.job_id);
          const tech = t.service_tech_id ? memberById.get(t.service_tech_id) : undefined;
          const stamp = new Date(t.submitted_at).toLocaleString("en-US", {
            timeZone: "America/New_York",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          return (
            <article key={t.id} className="break-inside-avoid space-y-3 rounded-2xl border p-4 print:border-black/30">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-lg font-semibold">
                  {t.job_number} · {job?.client_name ?? "Job"}
                </h2>
                <p className="text-sm text-muted-foreground">{stamp}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {[job?.address, job?.city].filter(Boolean).join(", ") || "No address"}
                {tech ? ` · ${tech.display_name?.trim() || tech.email}` : ""}
              </p>
              <p className="whitespace-pre-wrap text-base leading-relaxed">{t.issue}</p>
              {t.urls.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {t.urls.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u.path} src={u.url} alt="" className="h-36 w-full rounded-xl object-cover print:h-40" />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No photos on this ticket.</p>
              )}
            </article>
          );
        })
      )}

      <p className="hidden text-xs text-muted-foreground print:block">Printed from PermitAIO Service Dashboard.</p>
    </div>
  );
}
