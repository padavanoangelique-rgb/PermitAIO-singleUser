import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { JOB_BTN, PILL } from "@/lib/ui/chrome";
import { FILL_BLUE } from "@/lib/ui/fills";

type AssignmentRow = { job_id: string; job_number: string; scheduled_date: string | null };
type JobRow = { id: string; job_number: string; client_name: string; address: string | null; city: string | null };

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function InstallCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const params = await searchParams;

  const today = new Date();
  let year = today.getUTCFullYear();
  let month = today.getUTCMonth();
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  const monthStart = `${year}-${pad(month + 1)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthEnd = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;

  const prevDate = new Date(Date.UTC(year, month - 1, 1));
  const nextDate = new Date(Date.UTC(year, month + 1, 1));
  const prevMonth = `${prevDate.getUTCFullYear()}-${pad(prevDate.getUTCMonth() + 1)}`;
  const nextMonth = `${nextDate.getUTCFullYear()}-${pad(nextDate.getUTCMonth() + 1)}`;

  const supabase = await createClient();
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          gte: (a: string, b: string) => {
            lte: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
  const { data: assignmentRows } = await db
    .from("install_job_assignments")
    .select("job_id, job_number, scheduled_date")
    .eq("org_id", activeOrg.id)
    .gte("scheduled_date", monthStart)
    .lte("scheduled_date", monthEnd);
  const assignments = (assignmentRows ?? []) as AssignmentRow[];

  const jobIds = [...new Set(assignments.map((a) => a.job_id))];
  let jobs: JobRow[] = [];
  if (jobIds.length) {
    const { data: jobRows } = await supabase
      .from("jobs")
      .select("id, job_number, client_name, address, city")
      .eq("org_id", activeOrg.id)
      .in("id", jobIds);
    jobs = (jobRows ?? []) as JobRow[];
  }
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const byDay = new Map<number, AssignmentRow[]>();
  for (const a of assignments) {
    if (!a.scheduled_date) continue;
    const day = Number(a.scheduled_date.slice(8, 10));
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(a);
  }

  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = year === today.getUTCFullYear() && month === today.getUTCMonth();
  const todayNum = today.getUTCDate();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Install</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Install calendar</h1>
          <p className="text-sm text-muted-foreground">Jobs scheduled for install crews this month.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/install/calendar?month=${prevMonth}`}
            className={`${PILL} h-9 w-9 justify-center px-0 ${FILL_BLUE}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel(year, month)}</span>
          <Link
            href={`/install/calendar?month=${nextMonth}`}
            className={`${PILL} h-9 w-9 justify-center px-0 ${FILL_BLUE}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-w-[700px] grid-cols-7">
          {cells.map((day, i) => {
            const rows = day ? (byDay.get(day) ?? []) : [];
            const isToday = isCurrentMonth && day === todayNum;
            return (
              <div key={i} className={`min-h-28 rounded-2xl p-1.5 ${day ? "" : "opacity-40"}`}>
                {day ? (
                  <>
                    <p className={`mb-1 text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</p>
                    <div className="space-y-1">
                      {rows.map((a) => {
                        const job = jobById.get(a.job_id);
                        return (
                          <Link
                            key={a.job_id}
                            href={`/jobs/${a.job_id}`}
                            className={`${JOB_BTN} h-7 text-[11px]`}
                            title={`${a.job_number} · ${job?.client_name ?? ""}`}
                          >
                            {a.job_number}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
