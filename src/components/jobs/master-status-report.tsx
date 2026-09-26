import type { Tables } from "@/lib/supabase/types";
import { normalizeTradeFamily, type TradeFamily } from "@/lib/jobs/trade";

// The report only needs this subset of job columns, so callers can pass a
// narrower select() result instead of a full jobs row.
type Job = Pick<
  Tables<"jobs">,
  | "id"
  | "client_name"
  | "job_number"
  | "trade_type"
  | "sub_status"
  | "permit_number"
  | "jurisdiction"
  | "assigned_date"
  | "submitted_date"
  | "approved_date"
  | "contract_value"
>;

// A job's linked HOA submission, with the HOA name (and the parent job's
// trade type) already resolved so the report doesn't need a second lookup.
type HoaJobRow = Pick<
  Tables<"hoa_jobs">,
  | "id"
  | "job_number"
  | "job_name"
  | "address"
  | "status"
  | "assigned_to"
  | "assigned_date"
  | "date_submitted"
  | "date_approved"
> & { hoa_name: string | null; trade_type: string | null };

const STATUS_ORDER = [
  "Need to Submit",
  "In Review",
  "Approved",
  "Approved and Printed",
  "Complete",
] as const;

const TRADE_SECTIONS: { family: TradeFamily; label: string }[] = [
  { family: "windows", label: "Windows" },
  { family: "roofing", label: "Roofing" },
  { family: "general", label: "General" },
];

const NAVY = "#1F3A5F";
const th = "border border-gray-400 px-2 py-1 text-left font-bold text-white";
const td = "border border-gray-400 px-2 py-1 align-top";

const us = (d: string | null) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}/${y}`;
};
const dateLabel = (date = new Date()) =>
  date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// One printable document combining the permit book (grouped by permit
// status) and the HOA book (grouped by HOA submittal status), so office
// staff can print a single status snapshot instead of two separate reports.
// Both books are further split into Windows / Roofing / General sections so
// the report can be handed to the right crew or filed separately.
export function MasterStatusReport({
  jobs,
  hoaJobs,
  orgName,
}: {
  jobs: Job[];
  hoaJobs: HoaJobRow[];
  orgName: string;
}) {
  const totalValue = jobs.reduce((sum, j) => sum + (j.contract_value ?? 0), 0);
  const permitComplete = jobs.filter((j) => j.sub_status === "Complete").length;

  return (
    <div className="hidden print:block print:bg-white print:p-6 print:text-black">
      <h1 className="text-center text-[20pt] font-bold" style={{ color: NAVY }}>
        {orgName}: Master Status Report
      </h1>
      <p className="text-center text-[11pt] text-gray-600">
        Jobs by status — Permits &amp; HOA, split by trade · As of {dateLabel()}
      </p>

      <div className="mt-3 grid grid-cols-4 gap-2 border-y border-black py-2 text-center text-[10px]">
        <Metric value={jobs.length} label="TOTAL JOBS" />
        <Metric value={currency(totalValue)} label="TOTAL CONTRACT VALUE" />
        <Metric value={hoaJobs.length} label="JOBS WITH HOA SUBMITTAL" />
        <Metric value={permitComplete} label="PERMITS COMPLETE" />
      </div>

      {TRADE_SECTIONS.map(({ family, label }) => {
        const tradeJobs = jobs.filter((j) => normalizeTradeFamily(j.trade_type) === family);
        const tradeHoaJobs = hoaJobs.filter((j) => normalizeTradeFamily(j.trade_type) === family);
        if (tradeJobs.length === 0 && tradeHoaJobs.length === 0) return null;
        return (
          <TradeSection
            key={family}
            label={label}
            jobs={tradeJobs}
            hoaJobs={tradeHoaJobs}
          />
        );
      })}

      <p className="mt-5 text-[9pt] italic text-gray-600">
        Source: PermitAIO — {orgName}, combined Permit Inventory &amp; HOA Tracker snapshot as of {dateLabel()}.
      </p>
    </div>
  );
}

function TradeSection({ label, jobs, hoaJobs }: { label: string; jobs: Job[]; hoaJobs: HoaJobRow[] }) {
  const permitGroups = STATUS_ORDER.map((status) => ({
    status,
    rows: jobs.filter((j) => j.sub_status === status),
  }));
  const hoaGroups = STATUS_ORDER.map((status) => ({
    status,
    rows: hoaJobs.filter((j) => j.status === status),
  }));

  return (
    <div className="mt-6 break-before-page first:break-before-avoid">
      <h2 className="border-b-2 pb-1 text-[16pt] font-bold" style={{ color: NAVY, borderColor: NAVY }}>
        {label} Jobs
      </h2>

      <h3 className="mt-3 text-[13pt] font-bold" style={{ color: NAVY }}>
        Permit Status
      </h3>
      {permitGroups.map(
        ({ status, rows }) =>
          rows.length > 0 && (
            <div key={status} className="mt-3 break-inside-avoid">
              <div className="flex items-center justify-between border-b border-black">
                <h4 className="text-[12pt] font-bold">
                  {status} ({rows.length})
                </h4>
                <span className="text-[12pt] font-bold">
                  {currency(rows.reduce((sum, j) => sum + (j.contract_value ?? 0), 0))}
                </span>
              </div>
              <table className="mt-1 w-full border-collapse text-[9pt]">
                <thead>
                  <tr className="print-fill" style={{ backgroundColor: NAVY }}>
                    {["Client", "Job #", "Permit #", "Jurisdiction", "Assigned", "Submitted", "Approved", "Value"].map(
                      (h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => (
                    <tr key={j.id}>
                      <td className={td}>{j.client_name}</td>
                      <td className={td}>{j.job_number}</td>
                      <td className={td}>{j.permit_number ?? ""}</td>
                      <td className={td}>{j.jurisdiction ?? ""}</td>
                      <td className={td}>{us(j.assigned_date)}</td>
                      <td className={td}>{us(j.submitted_date)}</td>
                      <td className={td}>{us(j.approved_date)}</td>
                      <td className={td}>{j.contract_value != null ? currency(j.contract_value) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
      )}
      {permitGroups.every((g) => g.rows.length === 0) && (
        <p className="mt-2 text-[10pt] italic">No {label.toLowerCase()} jobs with a permit status recorded.</p>
      )}

      <h3 className="mt-5 text-[13pt] font-bold" style={{ color: NAVY }}>
        HOA Status
      </h3>
      {hoaGroups.map(
        ({ status, rows }) =>
          rows.length > 0 && (
            <div key={status} className="mt-3 break-inside-avoid">
              <h4 className="border-b border-black text-[12pt] font-bold">
                {status} ({rows.length})
              </h4>
              <table className="mt-1 w-full border-collapse text-[9pt]">
                <thead>
                  <tr className="print-fill" style={{ backgroundColor: NAVY }}>
                    {["Job #", "Job Name", "HOA", "Address", "Assigned To", "Assigned", "Submitted", "Approved"].map(
                      (h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => (
                    <tr key={j.id}>
                      <td className={td}>{j.job_number || "—"}</td>
                      <td className={td}>{j.job_name || "—"}</td>
                      <td className={td}>{j.hoa_name || "Unlinked"}</td>
                      <td className={td}>{j.address}</td>
                      <td className={td}>{j.assigned_to || ""}</td>
                      <td className={td}>{us(j.assigned_date)}</td>
                      <td className={td}>{us(j.date_submitted)}</td>
                      <td className={td}>{us(j.date_approved)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
      )}
      {hoaGroups.every((g) => g.rows.length === 0) && (
        <p className="mt-2 text-[10pt] italic">No {label.toLowerCase()} jobs currently have an HOA submittal on file.</p>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="font-bold">{value}</p>
      <p>{label}</p>
    </div>
  );
}
