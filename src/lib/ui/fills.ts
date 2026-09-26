/** Filled chips matching Permit Builder: Forms (purple), job numbers (lime), Package (green), not-submitted (orange). */
export const FILL_PURPLE = "bg-violet-600 text-white dark:bg-violet-500 dark:text-white dark:hover:bg-violet-500";
export const FILL_BLUE = "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary";
export const FILL_GREEN = "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-500";
export const FILL_AMBER = "bg-amber-500 text-white dark:bg-amber-500 dark:text-white dark:hover:bg-amber-500";
const FILL_ORANGE = "bg-orange-500 text-white dark:bg-orange-500 dark:text-white dark:hover:bg-orange-500";

const JOB_NEEDS_ACTION = new Set([
  "Engineering Review",
  "Need Permit Submittal",
  "Needs Permit/HOA Submittal",
  "Needs HOA Submittal",
  "Product Arrived - Needs Permit",
  "Sales Manager Escalation",
  "Open Service",
  "Pending Change Order Windows",
]);

const JOB_WAITING = new Set([
  "RF Pending Permit",
  "Awaiting HOA",
  "In Review",
  "Awaiting Parts",
  "Partial Product Arrived",
]);

/** Same chip colors as Permit Builder. Explicit dark: fills so the select
 *  trigger's dark gray background does not cover them. Not navy. */
export function jobStatusFill(stage: string | null | undefined): string {
  if (!stage) return "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground";
  if (JOB_NEEDS_ACTION.has(stage)) return FILL_ORANGE;
  if (JOB_WAITING.has(stage)) return FILL_PURPLE;
  return FILL_GREEN;
}

export const STATUS_FILL: Record<string, string> = {
  "Need to Submit": FILL_PURPLE,
  "Quote Needed": FILL_AMBER,
  "Engineering Pending": FILL_AMBER,
  "Corrections Needed": FILL_AMBER,
  "In Review": FILL_BLUE,
  Approved: FILL_GREEN,
  "Approved and Printed": FILL_GREEN,
  Complete: "bg-muted text-muted-foreground",
};
