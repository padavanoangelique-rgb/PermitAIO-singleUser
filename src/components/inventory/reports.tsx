import type { Tables } from "@/lib/supabase/types";
import {
  STAGES, SUB_STATUSES, average, canonicalJurisdiction, currency, cycleDays, daysBetween,
  isFlagged, isImplausibleSpan, isReview30Plus, isSubmit5Plus, median, type SubStatus,
} from "@/lib/inventory/constants";

type Job = Tables<"jobs">;
const NAVY = "#1F3A5F";
const LIGHT_FILL = "#E8EDF3";
const us = (d: string | null) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}/${y}`;
};
const dateLabel = (date = new Date()) => date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const val = (jobs: Job[]) => jobs.reduce((sum, job) => sum + (job.contract_value ?? 0), 0);

export function ActivityReport({ jobs, period, orgName, who = "All permit techs", customStart, customEnd }: { jobs: Job[]; period: "day" | "week" | "month" | "custom"; orgName: string; who?: string; customStart?: string; customEnd?: string }) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let startIso: string, endIso: string;
  if (period === "custom" && customStart && customEnd) {
    startIso = customStart;
    endIso = customEnd;
  } else {
    let start: Date;
    if (period === "week") { start = new Date(end); start.setDate(start.getDate() - 6); }
    else if (period === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
    else start = end;
    startIso = iso(start);
    endIso = iso(end);
  }
  const inPeriod = (d: string | null) => !!d && d >= startIso && d <= endIso;
  const periodLabel = period === "custom" ? `${us(startIso)} – ${us(endIso)}` : period === "day" ? us(endIso) : period === "week" ? `Week of ${us(startIso)}` : end.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const submitted = jobs.filter((j) => inPeriod(j.submitted_date)).sort((a, b) => (a.submitted_date ?? "").localeCompare(b.submitted_date ?? ""));
  const approved = jobs.filter((j) => inPeriod(j.approved_date)).sort((a, b) => (a.approved_date ?? "").localeCompare(b.approved_date ?? ""));
  const th = "border border-gray-400 px-2 py-1 text-left font-bold text-white";
  const td = "border border-gray-400 px-2 py-1";
  const table = (rows: Job[], total: number) => (
    <table className="mt-1 w-full border-collapse text-[9pt]"><thead><tr className="print-fill" style={{ backgroundColor: NAVY }}>
      {["Client","Job #","Value","Permit #","Assigned","Submitted","Approved","Notes"].map((x) => <th key={x} className={th}>{x}</th>)}
    </tr></thead><tbody>
      {rows.map((j) => <tr key={j.id}><td className={td}>{j.client_name}</td><td className={td}>{j.job_number}</td><td className={td}>{j.contract_value != null ? currency(j.contract_value) : ""}</td><td className={td}>{j.permit_number ?? ""}</td><td className={td}>{us(j.assigned_date)}</td><td className={td}>{us(j.submitted_date)}</td><td className={td}>{us(j.approved_date)}</td><td className={td}>{j.notes ?? ""}</td></tr>)}
      {rows.length === 0 && <tr><td className={td} colSpan={8}>None in this period.</td></tr>}
      <tr className="print-fill font-bold" style={{ backgroundColor: LIGHT_FILL }}><td className={td}>Total</td><td className={td}></td><td className={td}>{currency(total)}</td><td className={td}></td><td className={td}></td><td className={td}></td><td className={td}></td><td className={td}></td></tr>
    </tbody></table>
  );
  return <PrintShell>
    <h1 className="text-center text-[20pt] font-bold" style={{ color: NAVY }}>{periodLabel} Permit Activity Report</h1>
    <p className="text-center text-[11pt] text-gray-600">{orgName} — Permit Tracker · {who}<br />As of {dateLabel(now)}</p>
    <h2 className="mt-5 text-[14pt] font-bold" style={{ color: NAVY }}>Summary</h2>
    <table className="mt-1 w-full border-collapse text-[9pt]"><thead><tr className="print-fill" style={{ backgroundColor: NAVY }}><th className={th}>Metric</th><th className={th}>Count</th><th className={th}>Value</th></tr></thead><tbody>
      <tr><td className={td}>Permits Submitted ({periodLabel})</td><td className={td}>{submitted.length}</td><td className={td}>{currency(val(submitted))}</td></tr>
      <tr><td className={td}>Permits Approved ({periodLabel})</td><td className={td}>{approved.length}</td><td className={td}>{currency(val(approved))}</td></tr>
    </tbody></table>
    <h2 className="mt-5 text-[14pt] font-bold" style={{ color: NAVY }}>Permits Submitted — {periodLabel}</h2>{table(submitted, val(submitted))}
    <h2 className="mt-5 text-[14pt] font-bold" style={{ color: NAVY }}>Permits Approved — {periodLabel}</h2>{table(approved, val(approved))}
    <p className="mt-4 text-[9pt] italic text-gray-600">Source: Permit Inventory — {orgName}, live permit tracker as of {now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p>
  </PrintShell>;
}

export function ToDoReport({ jobs, who, orgName }: { jobs: Job[]; who: string; orgName: string }) {
  const now = new Date(), today = now.toISOString().slice(0, 10);
  const toSubmit = jobs.filter((j) => j.sub_status === "Need to Submit").map((job) => ({ job, days: daysBetween(job.assigned_date, today) })).sort((a,b) => (b.days ?? -1) - (a.days ?? -1)).slice(0,5);
  const inReview = jobs.filter((j) => j.submitted_date && !j.approved_date).map((job) => ({ job, days: daysBetween(job.submitted_date, today) })).sort((a,b) => (b.days ?? -1) - (a.days ?? -1)).slice(0,5);
  const section = (title: string, subtitle: string, rows: typeof toSubmit, date: "Assigned" | "Submitted", remaining: number) => <div className="mt-5 break-inside-avoid">
    <h2 className="text-sm font-bold">{title}</h2><p className="text-[10px] italic">{subtitle}</p>
    <table className="mt-1 w-full border-collapse"><thead><tr>{["✓","Days","Client","Job #","Jurisdiction","Permit #","Value",date,"Notes"].map((x) => <th key={x} className="border-b border-black px-1 py-1 text-left text-[10px] uppercase">{x}</th>)}</tr></thead><tbody>
      {rows.map(({job,days}) => <tr key={job.id}><td className="border-b border-gray-300 px-1 py-2 text-[11px] align-top"><span className="inline-block h-3 w-3 border border-black" /></td><td className="border-b border-gray-300 px-1 py-2 text-[11px] font-bold align-top">{days ?? "—"}</td><td className="border-b border-gray-300 px-1 py-2 text-[11px] align-top">{job.client_name}</td><td className="border-b border-gray-300 px-1 py-2 text-[11px] align-top">{job.job_number}</td><td className="border-b border-gray-300 px-1 py-2 text-[11px] align-top">{job.jurisdiction ?? ""}</td><td className="border-b border-gray-300 px-1 py-2 text-[11px] align-top">{job.permit_number ?? ""}</td><td className="border-b border-gray-300 px-1 py-2 text-[11px] align-top">{job.contract_value != null ? currency(job.contract_value) : ""}</td><td className="border-b border-gray-300 px-1 py-2 text-[11px] align-top">{date === "Assigned" ? job.assigned_date ?? "" : job.submitted_date ?? ""}</td><td className="border-b border-gray-300 px-1 py-2 text-[11px] align-top">{job.notes ?? ""}</td></tr>)}
      {rows.length === 0 && <tr><td className="border-b border-gray-300 px-1 py-2 text-[11px]" colSpan={9}>Nothing outstanding — clear.</td></tr>}
    </tbody></table>{remaining > rows.length && <p className="mt-1 text-[10px] italic">{remaining - rows.length} more in this status beyond the five shown.</p>}
  </div>;
  const totalToSubmit = jobs.filter((j) => j.sub_status === "Need to Submit").length, totalInReview = jobs.filter((j) => j.submitted_date && !j.approved_date).length;
  return <PrintShell><h1 className="text-xl font-bold">Permit To-Do List</h1><p className="text-xs">{orgName} · {who} · {dateLabel(now)}</p>
    {section("1 — Submit these","Oldest jobs still waiting to go in. Entirely within your control.",toSubmit,"Assigned",totalToSubmit)}
    {section("2 — Chase these","Longest sitting with the jurisdiction. A follow-up call is the lever.",inReview,"Submitted",totalInReview)}
    <p className="mt-5 text-[10px] italic">{totalToSubmit} awaiting submittal · {totalInReview} in review · Source: Permit Inventory, {orgName}.</p>
  </PrintShell>;
}

export function PerformanceReport({ jobs, who, orgName }: { jobs: Job[]; who: string; orgName: string }) {
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); };
  const last30 = daysAgo(30), last90 = daysAgo(90);
  const submitted30 = jobs.filter((j) => j.submitted_date && j.submitted_date >= last30), approved30 = jobs.filter((j) => j.approved_date && j.approved_date >= last30);
  const submitted90 = jobs.filter((j) => j.submitted_date && j.submitted_date >= last90), approved90 = jobs.filter((j) => j.approved_date && j.approved_date >= last90);
  const prepDays = jobs.map((j) => cycleDays(j.assigned_date,j.submitted_date)).filter((x): x is number => x !== null);
  const reviewDays = jobs.map((j) => cycleDays(j.submitted_date,j.approved_date)).filter((x): x is number => x !== null);
  const prepAvg=average(prepDays), prepMed=median(prepDays), within5Pct=prepDays.length ? Math.round((prepDays.filter((d)=>d<=5).length/prepDays.length)*100) : null;
  const n=(v:number|null,unit=" days")=>v===null?"—":`${v.toFixed(1)}${unit}`;
  const stat=(value:string|number,label:string)=><div><p className="font-bold">{value}</p><p>{label}</p></div>;
  const jurisdictions=new Set(jobs.map((j)=>canonicalJurisdiction(j.jurisdiction)).filter(Boolean));
  return <PrintShell><h1 className="text-xl font-bold">Permit Performance Summary</h1><p className="text-xs">{orgName} · {who} · As of {dateLabel()}</p>
    <PrintStats title="Last 30 days">{stat(submitted30.length,"PERMITS SUBMITTED")}{stat(currency(val(submitted30)),"VALUE SUBMITTED")}{stat(approved30.length,"PERMITS APPROVED")}{stat(currency(val(approved30)),"VALUE APPROVED")}</PrintStats>
    <PrintStats title="Last 90 days">{stat(submitted90.length,"PERMITS SUBMITTED")}{stat(currency(val(submitted90)),"VALUE SUBMITTED")}{stat(approved90.length,"PERMITS APPROVED")}{stat(currency(val(approved90)),"VALUE APPROVED")}</PrintStats>
    <h2 className="mt-4 border-b border-black text-sm font-bold">Turnaround (assigned to submitted)</h2><p className="mt-1 text-[10px] italic">This is the part of the cycle handled in-house. Jurisdiction review time is shown separately below, as it sits outside this desk.</p>
    <div className="mt-2 grid grid-cols-4 gap-2 border-b border-black pb-2 text-center text-[10px]">{stat(n(prepAvg),"AVERAGE TO SUBMIT")}{stat(n(prepMed),"MEDIAN TO SUBMIT")}{stat(within5Pct===null?"—":`${within5Pct}%`,"SUBMITTED WITHIN 5 DAYS")}{stat(prepDays.length,"PERMITS MEASURED")}</div>
    <h2 className="mt-4 border-b border-black text-sm font-bold">Overall book of work</h2><div className="mt-2 grid grid-cols-5 gap-2 border-b border-black pb-2 text-center text-[10px]">{stat(jobs.length,"JOBS HANDLED")}{stat(jobs.filter((j)=>j.submitted_date).length,"SUBMITTED TO DATE")}{stat(jobs.filter((j)=>j.approved_date).length,"APPROVED TO DATE")}{stat(jobs.filter((j)=>j.sub_status!=="Complete").length,"ACTIVE NOW")}{stat(jurisdictions.size,"JURISDICTIONS WORKED")}</div>
    <h2 className="mt-4 border-b border-black text-sm font-bold">Jurisdiction review time (for context)</h2><p className="mt-1 text-[10px]">Once submitted, permits average {n(average(reviewDays))} in review across {reviewDays.length} completed approvals. This is the jurisdiction&apos;s processing time, not turnaround controlled here.</p>
    {approved90.length > 0 && <div className="mt-4 break-inside-avoid"><h2 className="border-b border-black text-sm font-bold">Permits approved — last 90 days</h2><ApprovalTable jobs={approved90} /></div>}
    <p className="mt-4 text-[9pt] italic text-gray-600">Source: Permit Inventory — {orgName}, live permit tracker.</p>
  </PrintShell>;
}

export function CycleTimeReport({ jobs, orgName }: { jobs: Job[]; orgName: string }) {
  const today = new Date().toISOString().slice(0,10);
  const prepDays=jobs.map((j)=>cycleDays(j.assigned_date,j.submitted_date)).filter((x):x is number=>x!==null), reviewDays=jobs.map((j)=>cycleDays(j.submitted_date,j.approved_date)).filter((x):x is number=>x!==null), totalDays=jobs.map((j)=>cycleDays(j.assigned_date,j.approved_date)).filter((x):x is number=>x!==null);
  const waitingToSubmit=jobs.filter((j)=>j.assigned_date&&!j.submitted_date).map((job)=>({job,days:daysBetween(job.assigned_date,today)??0})).sort((a,b)=>b.days-a.days);
  const waitingInReview=jobs.filter((j)=>j.submitted_date&&!j.approved_date).map((job)=>({job,days:daysBetween(job.submitted_date,today)??0})).sort((a,b)=>b.days-a.days);
  function groupStats(keyOf:(j:Job)=>string) {
    const groups:Record<string,{prep:number[];review:number[];count:number}>={};
    for(const j of jobs){const key=keyOf(j)||"(not recorded)";if(!groups[key])groups[key]={prep:[],review:[],count:0};groups[key].count++;const prep=cycleDays(j.assigned_date,j.submitted_date),review=cycleDays(j.submitted_date,j.approved_date);if(prep!==null)groups[key].prep.push(prep);if(review!==null)groups[key].review.push(review);}
    return Object.entries(groups).map(([name,g])=>({name,count:g.count,prepAvg:average(g.prep),reviewAvg:average(g.review),reviewSamples:g.review.length})).sort((a,b)=>(b.reviewAvg??-1)-(a.reviewAvg??-1));
  }
  const byJurisdiction=groupStats((j)=>canonicalJurisdiction(j.jurisdiction)),byTech=groupStats((j)=>j.permit_tech),byTrade=groupStats((j)=>j.trade_type??"");
  const n=(v:number|null,suffix=" days")=>v===null?"—":`${v.toFixed(1)}${suffix}`;
  const wins:string[]=[],opportunities:string[]=[],notes:string[]=[];
  const daysAgo=(n:number)=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
  const last30=daysAgo(30), approvedRecently=jobs.filter((j)=>j.approved_date&&j.approved_date>=last30),submittedRecently=jobs.filter((j)=>j.submitted_date&&j.submitted_date>=last30),approvedAll=jobs.filter((j)=>j.approved_date);
  const prepAvg=average(prepDays),reviewAvg=average(reviewDays);
  if(approvedRecently.length){wins.push(`${approvedRecently.length} permit${approvedRecently.length===1?"":"s"} approved in the last 30 days, releasing ${currency(val(approvedRecently))} of work to schedule.`);}
  if(submittedRecently.length){wins.push(`${submittedRecently.length} permit${submittedRecently.length===1?"":"s"} submitted in the last 30 days, moving ${currency(val(submittedRecently))} into review.`);}
  if(approvedAll.length){wins.push(`${approvedAll.length} of ${jobs.length} jobs have reached approval — ${Math.round((approvedAll.length/Math.max(1,jobs.length))*100)}% of the book.`);}
  if(reviewAvg!==null){wins.push(`Permits are averaging ${reviewAvg.toFixed(1)} days in jurisdiction review once submitted.`);}
  const onTrack=jobs.filter((j)=>!isFlagged(j)).length;if(jobs.length){const pct=Math.round((onTrack/jobs.length)*100);if(pct>=50)wins.push(`${pct}% of jobs (${onTrack} of ${jobs.length}) are moving on schedule, with no delay flags.`);}
  const measurable=byJurisdiction.filter((g)=>g.reviewAvg!==null&&g.reviewSamples>=3&&g.name!=="(not recorded)");
  if(measurable.length){const fast=measurable[measurable.length-1];wins.push(`${fast.name} is your fastest jurisdiction at ${fast.reviewAvg!.toFixed(1)} days to approve — worth prioritising work there when scheduling is tight.`);}
  if(prepAvg!==null&&reviewAvg!==null)opportunities.push(prepAvg>reviewAvg?`Internal prep averages ${prepAvg.toFixed(1)} days vs ${reviewAvg.toFixed(1)} in review — the larger share is in-house, which means it's the part you can shorten directly.`:`Review averages ${reviewAvg.toFixed(1)} days vs ${prepAvg.toFixed(1)} for prep — prep is already tight, so gains will come from submittal quality and follow-up.`);
  if(measurable.length>=2){const slow=measurable[0],fast=measurable[measurable.length-1];opportunities.push(`${slow.name} averages ${slow.reviewAvg!.toFixed(1)} days vs ${fast.name} at ${fast.reviewAvg!.toFixed(1)} — building that gap into scheduling promises avoids surprises.`);}
  const stuckReview=waitingInReview.filter((w)=>w.days>=30);if(stuckReview.length)opportunities.push(`${stuckReview.length} permit${stuckReview.length===1?"":"s"} past 30 days in review, holding ${currency(stuckReview.reduce((s,w)=>s+(w.job.contract_value??0),0))} — a follow-up call is the fastest lever here.`);
  const stuckSubmit=waitingToSubmit.filter((w)=>w.days>=5);if(stuckSubmit.length)opportunities.push(`${stuckSubmit.length} job${stuckSubmit.length===1?"":"s"} ready to submit, worth ${currency(stuckSubmit.reduce((s,w)=>s+(w.job.contract_value??0),0))} — clearing these is the quickest win available.`);
  const badDates=jobs.filter((j)=>isImplausibleSpan(j.assigned_date,j.submitted_date)||isImplausibleSpan(j.submitted_date,j.approved_date));if(badDates.length)notes.push(`${badDates.length} job(s) have a date that can't be right (a span of years rather than days) and are excluded from the averages: ${badDates.slice(0,8).map((j)=>`${j.client_name} ${j.job_number}`).join(", ")}${badDates.length>8?", …":""}. Correcting those dates will fix these figures.`);
  const missingAssigned=jobs.filter((j)=>!j.assigned_date).length,missingSubmitted=jobs.filter((j)=>j.submitted_date===null&&j.sub_status!=="Need to Submit").length;if(missingAssigned||missingSubmitted)notes.push(`${missingAssigned} job(s) missing an assigned date and ${missingSubmitted} missing a submitted date are excluded from the averages — filling those in will sharpen these numbers.`);
  if(!reviewDays.length&&jobs.length)notes.push("No completed submit-to-approve cycles in this view yet, so timing averages are blank. They'll populate as permits are approved.");
  const groupTable=(title:string,rows:ReturnType<typeof groupStats>,label:string)=><div className="mt-4 break-inside-avoid"><h2 className="border-b border-black text-sm font-bold">{title}</h2><table className="mt-1 w-full border-collapse text-[10px]"><thead><tr className="border-b border-black text-left">{[label,"Jobs","Avg days to submit","Avg days in review","Approvals measured"].map((h)=><th key={h} className="py-1 pr-2">{h}</th>)}</tr></thead><tbody>{rows.map((r)=><tr key={r.name} className="border-b border-gray-300"><td className="py-1 pr-2">{r.name}</td><td className="py-1 pr-2">{r.count}</td><td className="py-1 pr-2">{n(r.prepAvg)}</td><td className="py-1 pr-2">{n(r.reviewAvg)}</td><td className="py-1 pr-2">{r.reviewSamples}</td></tr>)}</tbody></table></div>;
  const waitingTable=(title:string,rows:typeof waitingInReview,hasPermit:boolean)=><div className="mt-4 break-inside-avoid"><h2 className="border-b border-black text-sm font-bold">{title}</h2><table className="mt-1 w-full border-collapse text-[10px]"><thead><tr className="border-b border-black text-left">{["Days","Client","Job #","Jurisdiction",...(hasPermit?["Permit #"]:[]),"Value","Tech"].map((h)=><th key={h} className="py-1 pr-2">{h}</th>)}</tr></thead><tbody>{rows.slice(0,25).map(({job,days})=><tr key={job.id} className="border-b border-gray-300"><td className="py-1 pr-2 font-bold">{days}</td><td className="py-1 pr-2">{job.client_name}</td><td className="py-1 pr-2">{job.job_number}</td><td className="py-1 pr-2">{job.jurisdiction??""}</td>{hasPermit&&<td className="py-1 pr-2">{job.permit_number??""}</td>}<td className="py-1 pr-2">{job.contract_value!=null?currency(job.contract_value):""}</td><td className="py-1 pr-2">{job.permit_tech}</td></tr>)}</tbody></table></div>;
  return <PrintShell><h1 className="text-xl font-bold">{orgName}: Permit Cycle Times</h1><p className="text-xs">Where time goes, and where it can be recovered · As of {dateLabel()}</p>
    <div className="mt-3 grid grid-cols-6 gap-2 border-y border-black py-2 text-center text-[10px]"><Metric value={n(average(prepDays))} label="AVG ASSIGNED → SUBMITTED"/><Metric value={n(median(prepDays))} label="MEDIAN TO SUBMIT"/><Metric value={n(average(reviewDays))} label="AVG SUBMITTED → APPROVED"/><Metric value={n(median(reviewDays))} label="MEDIAN IN REVIEW"/><Metric value={n(average(totalDays))} label="AVG TOTAL CYCLE"/><Metric value={waitingToSubmit.length+waitingInReview.length} label="CURRENTLY WAITING"/></div>
    <Narrative title="What's working" items={wins}/><Narrative title="Where time can be recovered" items={opportunities}/><Narrative title="About these numbers" items={notes}/>
    {groupTable("Cycle time by jurisdiction",byJurisdiction,"Jurisdiction")}{groupTable("Cycle time by permit tech",byTech,"Permit tech")}{groupTable("Cycle time by product",byTrade,"Product")}
    {waitingInReview.length>0&&waitingTable("Longest currently in review",waitingInReview,true)}{waitingToSubmit.length>0&&waitingTable("Longest waiting to be submitted",waitingToSubmit,false)}
  </PrintShell>;
}

export function PrintReport({ byStage, scope, orgName }: { byStage: Record<string, Job[]>; scope: string; orgName: string }) {
  const printed=([] as Job[]).concat(...Object.values(byStage));
  const stats={totalJobs:printed.length,backlogValue:printed.filter((j)=>j.sub_status!=="Complete").reduce((s,j)=>s+(j.contract_value??0),0),bySubStatus:SUB_STATUSES.reduce((acc,status)=>{acc[status]=printed.filter((j)=>j.sub_status===status).length;return acc;},{} as Record<SubStatus,number>),review30:printed.filter(isReview30Plus).length,submit5:printed.filter(isSubmit5Plus).length};
  return <PrintShell><h1 className="text-xl font-bold">{orgName}: Permit Tracker</h1><p className="text-xs">Permit Inventory — backlog, permit status &amp; NOC tracking · As of {dateLabel()}</p><p className="mt-1 text-xs font-bold">Report scope: {scope}</p>
    <div className="mt-3 grid grid-cols-9 gap-2 border-y border-black py-2 text-center text-[10px]"><Metric value={stats.totalJobs} label="TOTAL JOBS"/><Metric value={currency(stats.backlogValue)} label="BACKLOG VALUE"/><Metric value={stats.bySubStatus["Need to Submit"]} label="NEED TO SUBMIT"/><Metric value={stats.bySubStatus["In Review"]} label="IN REVIEW"/><Metric value={stats.bySubStatus.Approved} label="APPROVED"/><Metric value={stats.bySubStatus["Approved and Printed"]} label="APPROVED & PRINTED"/><Metric value={stats.bySubStatus.Complete} label="COMPLETE"/><Metric value={stats.review30} label="REVIEW 30+ DAYS"/><Metric value={stats.submit5} label="SUBMIT 5+ DAYS"/></div>
    {STAGES.filter((stage)=>byStage[stage]?.length).map((stage)=>{const stageJobs=byStage[stage];return <div key={stage} className="mt-4 break-inside-avoid"><div className="flex items-center justify-between border-b border-black"><h2 className="text-sm font-bold">{stage} ({stageJobs.length})</h2><span className="text-sm font-bold">{currency(val(stageJobs))}</span></div><table className="mt-1 w-full border-collapse text-[10px]"><thead><tr className="border-b border-black text-left">{["Client","Job #","Contract","Product","Value","Permit Status","Permit #","Jurisdiction","Assigned","Submitted","Approved","NOC","Tech","Notes"].map((h)=><th key={h} className="py-1 pr-2">{h}</th>)}</tr></thead><tbody>{stageJobs.map((j)=><tr key={j.id} className="border-b border-gray-300"><td className="py-1 pr-2">{j.client_name}</td><td className="py-1 pr-2">{j.job_number}</td><td className="py-1 pr-2">{j.sale_date?new Date(j.sale_date).toLocaleDateString("en-US"):""}</td><td className="py-1 pr-2">{j.trade_type??""}</td><td className="py-1 pr-2">{j.contract_value!=null?currency(j.contract_value):""}</td><td className="py-1 pr-2">{j.sub_status}</td><td className="py-1 pr-2">{j.permit_number??""}</td><td className="py-1 pr-2">{j.jurisdiction??""}</td><td className="py-1 pr-2">{j.assigned_date??""}</td><td className="py-1 pr-2">{j.submitted_date??""}</td><td className="py-1 pr-2">{j.approved_date??""}</td><td className="py-1 pr-2">{j.noc_status}</td><td className="py-1 pr-2">{j.permit_tech}</td><td className="py-1 pr-2">{j.notes??""}</td></tr>)}</tbody></table></div>;})}
  </PrintShell>;
}

function PrintShell({ children }: { children: React.ReactNode }) { return <div className="hidden print:block print:bg-white print:p-6 print:text-black">{children}</div>; }
function Metric({ value, label }: { value: string | number; label: string }) { return <div><p className="font-bold">{value}</p><p>{label}</p></div>; }
function Narrative({ title, items }: { title: string; items: string[] }) { return items.length ? <div className="mt-4 break-inside-avoid"><h2 className="border-b border-black text-sm font-bold">{title}</h2><ul className="mt-1 list-disc pl-4 text-[10px]">{items.map((item,index)=><li key={index} className="mb-0.5">{item}</li>)}</ul></div> : null; }
function PrintStats({ title, children }: { title: string; children: React.ReactNode }) { return <><h2 className="mt-4 border-b border-black text-sm font-bold">{title}</h2><div className="mt-2 grid grid-cols-4 gap-2 border-b border-black pb-2 text-center text-[10px]">{children}</div></>; }
function ApprovalTable({ jobs }: { jobs: Job[] }) { const sorted=[...jobs].sort((a,b)=>(b.approved_date??"").localeCompare(a.approved_date??""));return <table className="mt-1 w-full border-collapse text-[10px]"><thead><tr className="border-b border-black text-left">{["Client","Job #","Permit #","Jurisdiction","Value","Submitted","Approved"].map((h)=><th key={h} className="py-1 pr-2">{h}</th>)}</tr></thead><tbody>{sorted.map((j)=><tr key={j.id} className="border-b border-gray-300"><td className="py-1 pr-2">{j.client_name}</td><td className="py-1 pr-2">{j.job_number}</td><td className="py-1 pr-2">{j.permit_number??""}</td><td className="py-1 pr-2">{j.jurisdiction??""}</td><td className="py-1 pr-2">{j.contract_value!=null?currency(j.contract_value):""}</td><td className="py-1 pr-2">{j.submitted_date??""}</td><td className="py-1 pr-2">{j.approved_date??""}</td></tr>)}</tbody><tfoot><tr className="font-bold"><td className="py-1 pr-2">Total</td><td className="py-1 pr-2">{jobs.length} permits</td><td className="py-1 pr-2"></td><td className="py-1 pr-2"></td><td className="py-1 pr-2">{currency(val(jobs))}</td><td className="py-1 pr-2"></td><td className="py-1 pr-2"></td></tr></tfoot></table>; }
