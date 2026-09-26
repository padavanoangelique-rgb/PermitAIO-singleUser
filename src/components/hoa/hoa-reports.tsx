import type { Tables } from "@/lib/supabase/types";

type Hoa = Tables<"hoas">;
type HoaJob = Tables<"hoa_jobs">;

const NAVY = "#1F3A5F";
const LIGHT_FILL = "#E8EDF3";
const us = (d: string | null) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}/${y}`;
};
const dateLabel = (date = new Date()) =>
  date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

const th = "border border-gray-400 px-2 py-1 text-left font-bold text-white";
const td = "border border-gray-400 px-2 py-1 align-top";
const jobHeaders = ["Job #", "Job Name", "Address", "Status", "Assigned To", "Assigned Date", "Submitted", "Approved", "Notes"];

function JobRows({ jobs }: { jobs: HoaJob[] }) {
  return (
    <>
      {jobs.map((j) => (
        <tr key={j.id}>
          <td className={td}>{j.job_number || "—"}</td>
          <td className={td}>{j.job_name || "—"}</td>
          <td className={td}>{j.address}</td>
          <td className={td}>{j.status}</td>
          <td className={td}>{j.assigned_to || ""}</td>
          <td className={td}>{us(j.assigned_date)}</td>
          <td className={td}>{us(j.date_submitted)}</td>
          <td className={td}>{us(j.date_approved)}</td>
          <td className={td}>{j.notes}</td>
        </tr>
      ))}
      {jobs.length === 0 && (
        <tr>
          <td className={td} colSpan={9}>
            No jobs.
          </td>
        </tr>
      )}
    </>
  );
}

// Mirrors the reference tool's printHoaReport() — one community's contact
// info, qualifications, notes, and its full job history.
export function HoaReport({ hoa, jobs, orgName }: { hoa: Hoa; jobs: HoaJob[]; orgName: string }) {
  return (
    <PrintShell>
      <h1 className="text-[20pt] font-bold" style={{ color: NAVY }}>
        {hoa.name}
      </h1>
      <p className="text-[11pt] text-gray-600">
        {orgName} — HOA Report · Printed {dateLabel()}
      </p>
      <table className="mt-3 w-full border-collapse text-[9pt]">
        <tbody>
          <tr>
            <td className={td}>
              <b>Management Co:</b> {hoa.mgmt_co || "—"}
            </td>
            <td className={td}>
              <b>Contact:</b> {hoa.contact_name || "—"}
            </td>
          </tr>
          <tr>
            <td className={td}>
              <b>Phone:</b> {hoa.phone || "—"}
            </td>
            <td className={td}>
              <b>Email:</b> {hoa.email || "—"}
            </td>
          </tr>
          <tr>
            <td className={td} colSpan={2}>
              <b>Address:</b> {hoa.address || "—"}
            </td>
          </tr>
        </tbody>
      </table>
      <h2 className="mt-4 text-[13pt] font-bold" style={{ color: NAVY }}>
        Qualifications / Submittal Requirements
      </h2>
      <p className="text-[10pt] whitespace-pre-wrap">{hoa.qualifications || "—"}</p>
      <h2 className="mt-4 text-[13pt] font-bold" style={{ color: NAVY }}>
        Notes
      </h2>
      <p className="text-[10pt] whitespace-pre-wrap">{hoa.notes || "—"}</p>
      <h2 className="mt-4 text-[13pt] font-bold" style={{ color: NAVY }}>
        Jobs ({jobs.length})
      </h2>
      <table className="mt-1 w-full border-collapse text-[9pt]">
        <thead>
          <tr className="print-fill" style={{ backgroundColor: NAVY }}>
            {jobHeaders.map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <JobRows jobs={jobs} />
        </tbody>
      </table>
      <p className="mt-4 text-[9pt] italic text-gray-600">
        Source: HOA Tracker — {orgName}, live directory as of{" "}
        {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
      </p>
    </PrintShell>
  );
}

// Mirrors the reference tool's printJobsReport() — the full "All Jobs" table
// (respecting whatever status/tech/search filters are active), with the HOA
// name resolved per row.
export function HoaJobsReport({
  jobs,
  hoas,
  filterLabel,
  orgName,
}: {
  jobs: HoaJob[];
  hoas: Hoa[];
  filterLabel: string;
  orgName: string;
}) {
  return (
    <PrintShell>
      <h1 className="text-[20pt] font-bold" style={{ color: NAVY }}>
        Jobs Report
      </h1>
      <p className="text-[11pt] text-gray-600">
        {orgName} — HOA Tracker · Filter: {filterLabel} · Printed {dateLabel()} · {jobs.length} job{jobs.length === 1 ? "" : "s"}
      </p>
      <table className="mt-3 w-full border-collapse text-[9pt]">
        <thead>
          <tr className="print-fill" style={{ backgroundColor: NAVY }}>
            {["Job #", "Job Name", "HOA", "Address", "Status", "Assigned To", "Assigned Date", "Submitted", "Approved", "Notes"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => {
            const hoa = hoas.find((h) => h.id === j.hoa_id);
            return (
              <tr key={j.id}>
                <td className={td}>{j.job_number || "—"}</td>
                <td className={td}>{j.job_name || "—"}</td>
                <td className={td}>{hoa ? hoa.name : "Unlinked"}</td>
                <td className={td}>{j.address}</td>
                <td className={td}>{j.status}</td>
                <td className={td}>{j.assigned_to || ""}</td>
                <td className={td}>{us(j.assigned_date)}</td>
                <td className={td}>{us(j.date_submitted)}</td>
                <td className={td}>{us(j.date_approved)}</td>
                <td className={td}>{j.notes}</td>
              </tr>
            );
          })}
          {jobs.length === 0 && (
            <tr>
              <td className={td} colSpan={10}>
                No jobs match this filter.
              </td>
            </tr>
          )}
          <tr className="print-fill font-bold" style={{ backgroundColor: LIGHT_FILL }}>
            <td className={td} colSpan={10}>
              Total: {jobs.length}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-4 text-[9pt] italic text-gray-600">
        Source: HOA Tracker — {orgName}, live directory as of{" "}
        {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
      </p>
    </PrintShell>
  );
}

function PrintShell({ children }: { children: React.ReactNode }) {
  return <div className="hidden print:block print:bg-white print:p-6 print:text-black">{children}</div>;
}
