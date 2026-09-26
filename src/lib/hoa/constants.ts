// Ported 1:1 from the original HOA Tracker (FLHOAtracker) — same statuses,
// same tech roster, same behavior. Only the module location changed.

export const HOA_JOB_STATUSES = [
  "Need to Submit",
  "In Review",
  "Approved",
  "Approved and Printed",
  "Complete",
] as const;

export type HoaJobStatus = (typeof HOA_JOB_STATUSES)[number];

export const HOA_TECHS = ["Tech 1", "Tech 2", "Tech 3"] as const;

export const NO_HOA_TECH = "NO HOA";

/** Generates the org's real HOA tech roster from its seat count
 * (organizations.hoa_tech_seats) instead of the old fixed 3-slot list.
 * Falls back to the historical 3 slots when the count is missing, and
 * clamps to a sane range so a bad value can't blow up a dropdown. */
export function hoaTechSlots(seats: number | null | undefined): string[] {
  const n = Math.min(50, Math.max(1, seats ?? 3));
  return Array.from({ length: n }, (_, i) => `Tech ${i + 1}`);
}
