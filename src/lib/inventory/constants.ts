import type { Tables } from "@/lib/supabase/types";

export type SubStatus =
  | "Need to Submit"
  | "Quote Needed"
  | "Engineering Pending"
  | "In Review"
  | "Corrections Needed"
  | "Approved"
  | "Approved and Printed"
  | "Complete";

export type NocStatus = "None" | "Pending" | "Submitted" | "Recorded";

export const PERMIT_TECHS = ["Permit Tech 1", "Permit Tech 2", "Permit Tech 3"];

/** Generates the org's real permit tech roster from its seat count
 * (organizations.permit_tech_seats) instead of the old fixed 3-slot list.
 * Falls back to the historical 3 slots when the count is missing, and
 * clamps to a sane range so a bad value can't blow up a dropdown. */
export function permitTechSlots(seats: number | null | undefined): string[] {
  const n = Math.min(50, Math.max(1, seats ?? 3));
  return Array.from({ length: n }, (_, i) => `Permit Tech ${i + 1}`);
}

export const STAGES: string[] = [
  "Engineering Review",
  "Need Permit Submittal",
  "Needs Permit/HOA Submittal",
  "Needs HOA Submittal",
  "RF Pending Permit",
  "Awaiting HOA",
  "In Review",
  "Ready to Order",
  "Ordered",
  "Awaiting Parts",
  "Product Arrived - Needs Permit",
  "Partial Product Arrived",
  "Product Arrived",
  "RF Ready for Install",
  "Scheduled for Install",
  "Install Started",
  "In Progress",
  "Needs Final Inspection",
  "Scheduled Final Inspection",
  "Inspected",
  "Pending Change Order Windows",
  "Open Service",
  "Sales Manager Escalation",
];

/** When an ordered date is first entered, move the job to Ordered.
 *  Jobs already at Ordered or later stay put. */
export function stageWhenOrdered(current: string | null | undefined): string {
  const orderedAt = STAGES.indexOf("Ordered");
  const now = STAGES.indexOf(current ?? "");
  if (now >= orderedAt) return current ?? "Ordered";
  return "Ordered";
}

export const SUB_STATUSES: SubStatus[] = [
  "Need to Submit",
  "Quote Needed",
  "Engineering Pending",
  "In Review",
  "Corrections Needed",
  "Approved",
  "Approved and Printed",
  "Complete",
];

export const NOC_STATUSES: NocStatus[] = ["None", "Pending", "Submitted", "Recorded"];

export const SUB_STATUS_TONE: Record<SubStatus, "success" | "pending" | "blocked"> = {
  "Need to Submit": "blocked",
  "Quote Needed": "blocked",
  "Engineering Pending": "pending",
  "In Review": "pending",
  "Corrections Needed": "blocked",
  Approved: "success",
  "Approved and Printed": "success",
  Complete: "success",
};

export const JURISDICTIONS: string[] = [
  "Palm Beach County",
  "Broward County",
  "Miami-Dade County",
  "Martin County",
  "Boca Raton",
  "Boynton Beach",
  "Delray Beach",
  "Jupiter",
  "Lake Worth Beach",
  "Palm Beach Gardens",
  "Riviera Beach",
  "Royal Palm Beach",
  "Wellington",
  "West Palm Beach",
  "Coconut Creek",
  "Cooper City",
  "Coral Springs",
  "Davie",
  "Deerfield Beach",
  "Fort Lauderdale",
  "Hollywood",
  "Miramar",
  "Pembroke Pines",
  "Plantation",
  "Pompano Beach",
  "Sunrise",
  "Tamarac",
  "Weston", "Dania Beach", "Hallandale Beach", "Hillsboro Beach", "Lauderdale Lakes", "Lauderdale-By-The-Sea", "Lauderhill", "Lazy Lake", "Lighthouse Point", "Margate", "North Lauderdale", "Oakland Park", "Parkland", "Pembroke Park", "Sea Ranch Lakes", "Southwest Ranches", "West Park", "Wilton Manors", "Aventura",
  "Coral Gables",
  "Doral",
  "Hialeah",
  "Homestead",
  "Kendall",
  "Miami",
  "Miami Beach",
  "Miami Gardens",
  "North Miami",
  "Pinecrest",
  "West Miami",
  "Jensen Beach",
  "Palm City",
  "Stuart",
  "St. Lucie County",
  "Fort Pierce",
  "Port St. Lucie",
];

export function canonicalJurisdiction(value: string | null): string {
  const t = (value ?? "").trim();
  if (!t) return "";
  const match = JURISDICTIONS.find((j) => j.toLowerCase() === t.toLowerCase());
  return match ?? t;
}

const COUNTY_BY_JURISDICTION: Record<string, string> = {
  "Palm Beach County": "Palm Beach County",
  "Boca Raton": "Palm Beach County",
  "Boynton Beach": "Palm Beach County",
  "Delray Beach": "Palm Beach County",
  "Jupiter": "Palm Beach County",
  "Lake Worth Beach": "Palm Beach County",
  "Palm Beach Gardens": "Palm Beach County",
  "Riviera Beach": "Palm Beach County",
  "Royal Palm Beach": "Palm Beach County",
  "Wellington": "Palm Beach County",
  "West Palm Beach": "Palm Beach County",
  "Broward County": "Broward County",
  "Coconut Creek": "Broward County",
  "Cooper City": "Broward County",
  "Coral Springs": "Broward County",
  "Davie": "Broward County",
  "Deerfield Beach": "Broward County",
  "Fort Lauderdale": "Broward County",
  "Hollywood": "Broward County",
  "Miramar": "Broward County",
  "Pembroke Pines": "Broward County",
  "Plantation": "Broward County",
  "Pompano Beach": "Broward County",
  "Sunrise": "Broward County",
  "Tamarac": "Broward County",
  "Weston": "Broward County", "Dania Beach": "Broward County", "Hallandale Beach": "Broward County", "Hillsboro Beach": "Broward County", "Lauderdale Lakes": "Broward County", "Lauderdale-By-The-Sea": "Broward County", "Lauderhill": "Broward County", "Lazy Lake": "Broward County", "Lighthouse Point": "Broward County", "Margate": "Broward County", "North Lauderdale": "Broward County", "Oakland Park": "Broward County", "Parkland": "Broward County", "Pembroke Park": "Broward County", "Sea Ranch Lakes": "Broward County", "Southwest Ranches": "Broward County", "West Park": "Broward County", "Wilton Manors": "Broward County", "Miami-Dade County": "Miami-Dade County",
  "Aventura": "Miami-Dade County",
  "Coral Gables": "Miami-Dade County",
  "Doral": "Miami-Dade County",
  "Hialeah": "Miami-Dade County",
  "Homestead": "Miami-Dade County",
  "Kendall": "Miami-Dade County",
  "Miami": "Miami-Dade County",
  "Miami Beach": "Miami-Dade County",
  "Miami Gardens": "Miami-Dade County",
  "North Miami": "Miami-Dade County",
  "Pinecrest": "Miami-Dade County",
  "West Miami": "Miami-Dade County",
  "Martin County": "Martin County",
  "Jensen Beach": "Martin County",
  "Palm City": "Martin County",
  "Stuart": "Martin County",
  "St. Lucie County": "St. Lucie County",
  "Fort Pierce": "St. Lucie County",
  "Port St. Lucie": "St. Lucie County",
};

export const COUNTIES: string[] = ["Palm Beach County", "Broward County", "Miami-Dade County", "Martin County", "St. Lucie County"];

export function jurisdictionsInCounty(county: string): string[] {
  if (!county) return [];
  return JURISDICTIONS.filter((j) => COUNTY_BY_JURISDICTION[j] === county);
}

export function countyOf(value: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  for (const part of raw.split(",")) {
    const canonical = canonicalJurisdiction(part);
    const county = canonical ? COUNTY_BY_JURISDICTION[canonical] : undefined;
    if (county) return county;
  }
  return "";
}

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  const days = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return days < 0 ? null : days;
}

export function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export const MAX_PLAUSIBLE_CYCLE_DAYS = 1095;

export function cycleDays(from: string | null, to: string | null): number | null {
  const d = daysBetween(from, to);
  if (d === null) return null;
  return d > MAX_PLAUSIBLE_CYCLE_DAYS ? null : d;
}

export function isImplausibleSpan(from: string | null, to: string | null): boolean {
  const d = daysBetween(from, to);
  return d !== null && d > MAX_PLAUSIBLE_CYCLE_DAYS;
}

type Job = Tables<"jobs">;

export function isReview30Plus(job: Job): boolean {
  if (job.sub_status !== "In Review") return false;
  const d = daysSince(job.submitted_date);
  return d != null && d >= 30;
}

export function isSubmit5Plus(job: Job): boolean {
  if (job.sub_status !== "Need to Submit") return false;
  const d = daysSince(job.assigned_date);
  return d != null && d >= 5;
}

export function isFlagged(job: Job): boolean {
  return isReview30Plus(job) || isSubmit5Plus(job);
}

export function currency(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

/** Short money for tight KPI tiles so a large backlog stays inside the card. */
export function compactCurrency(n: number): string {
  const abs = Math.abs(Math.round(n));
  if (abs >= 1_000_000) {
    const millions = n / 1_000_000;
    return (
      "$" +
      millions.toLocaleString("en-US", {
        maximumFractionDigits: abs >= 10_000_000 ? 1 : 2,
        minimumFractionDigits: 0,
      }) +
      "M"
    );
  }
  if (abs >= 100_000) {
    return "$" + Math.round(n / 1000).toLocaleString("en-US") + "k";
  }
  return currency(n);
}
