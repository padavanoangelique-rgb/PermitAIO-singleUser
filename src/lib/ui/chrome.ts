import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "./fills";

export const PILL =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm";
export const TAP =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-sm";
export const JOB_BTN =
  "inline-flex h-8 min-w-[5.5rem] w-full items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold tabular-nums text-primary-foreground shadow-sm";
export const NAME_PILL =
  `inline-flex h-8 w-full max-w-[13rem] min-w-0 items-center justify-center overflow-hidden rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_PURPLE}`;
export const FIELD =
  "mt-1 block h-11 w-full rounded-full border border-border bg-background px-3 text-sm text-foreground";
export const BTN_BLUE = `${PILL} ${FILL_BLUE}`;
export const BTN_PURPLE = `${PILL} ${FILL_PURPLE}`;
export const BTN_GREEN = `${PILL} ${FILL_GREEN}`;
export const TAP_BLUE = `${TAP} ${FILL_BLUE}`;
export const TAP_PURPLE = `${TAP} ${FILL_PURPLE}`;
export const TAP_GREEN = `${TAP} ${FILL_GREEN}`;
export const APP_GRID =
  "grid w-full grid-cols-[1.25rem_5.75rem_minmax(0,1fr)] items-center gap-x-2 sm:grid-cols-[1.25rem_5.75rem_minmax(7rem,1.2fr)_minmax(5rem,.9fr)]";
export const ROW =
  "flex w-full flex-wrap items-center gap-2 rounded-2xl px-2 py-2 text-left hover:bg-muted/40";
export const CELL = "min-w-0 truncate text-sm leading-8";
export const LOOKUP =
  "flex flex-wrap items-end gap-3 px-1 py-2";
