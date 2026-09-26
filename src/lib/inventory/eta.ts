/** True when Material ETA is overdue or fewer than 14 days away. */
export function materialEtaIsSoon(value: string | null | undefined, withinDays = 14): boolean {
  if (!value) return false;
  const eta = new Date(`${value}T00:00:00`);
  if (Number.isNaN(eta.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((eta.getTime() - today.getTime()) / 86_400_000);
  return days < withinDays;
}

export function formatEtaDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
}

export const ETA_SOON_PILL =
  "inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-3 text-sm font-semibold tabular-nums text-white shadow-sm sm:h-8";
export const ETA_SOON_PILL_SM =
  "inline-flex h-11 items-center rounded-full bg-red-600 px-3 text-sm font-semibold tabular-nums text-white shadow-sm sm:h-8";

/** Green < 15 days, yellow at 15 (halfway), red at 30 days still open. Closed clocks stay green. */
export type DateTone = "ok" | "warn" | "late";

export function reviewDateTone(
  start: string | null | undefined,
  closed: string | null | undefined,
  today = new Date(),
): DateTone {
  if (closed) return "ok";
  if (!start) return "ok";
  const a = new Date(`${start.slice(0, 10)}T00:00:00`);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  if (Number.isNaN(a.getTime())) return "ok";
  const days = Math.round((t.getTime() - a.getTime()) / 86_400_000);
  if (days >= 30) return "late";
  if (days >= 15) return "warn";
  return "ok";
}

/** Green > 30 days out, yellow 15–30, red under 15 days or already expired. */
export function expireDateTone(
  expiresOn: string | null | undefined,
  today = new Date(),
): DateTone {
  if (!expiresOn) return "ok";
  const d = new Date(`${expiresOn.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "ok";
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (days < 15) return "late";
  if (days < 30) return "warn";
  return "ok";
}

export function daysUntil(value: string | null | undefined, today = new Date()): number | null {
  if (!value) return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

export const DATE_TONE_PILL: Record<DateTone, string> = {
  ok: "inline-flex h-8 items-center justify-center rounded-full bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm dark:bg-emerald-500",
  warn: "inline-flex h-8 items-center justify-center rounded-full bg-amber-500 px-3 text-sm font-semibold text-white shadow-sm",
  late: "inline-flex h-8 items-center justify-center rounded-full bg-red-600 px-3 text-sm font-semibold text-white shadow-sm",
};

/** Fixed-width slots so Asgn / Sub / Appr / Ord / ETA stay in their own column. */
export const DATE_PILL_SLOT =
  "inline-flex h-8 w-full min-w-0 items-center justify-center overflow-hidden rounded-full px-1 text-xs font-semibold tabular-nums shadow-sm";
export const DATE_PILL_EMPTY = `${DATE_PILL_SLOT} bg-muted text-muted-foreground`;
export const DATE_TONE_SLOT: Record<DateTone, string> = {
  ok: `${DATE_PILL_SLOT} bg-emerald-600 text-white dark:bg-emerald-500`,
  warn: `${DATE_PILL_SLOT} bg-amber-500 text-white`,
  late: `${DATE_PILL_SLOT} bg-red-600 text-white`,
};
export const DATE_META_GRID =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_repeat(5,6.9rem)] items-center gap-x-1";
export const DATE_INPUT_HIT =
  "absolute inset-0 z-10 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";
