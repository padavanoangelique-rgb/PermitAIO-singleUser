"use client";

import { createElement as h } from "react";
import { JOB_ROW_GRID } from "./job-row";

// Column titles for a single JobRow (the board has its own header). Same grid as the row so the dates line up.
const HEADER_CLASS = `${JOB_ROW_GRID} mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`;
const COLUMNS: [string, string][] = [
  ["Job #", ""],
  ["Contract", ""],
  ["Client", ""],
  ["City", ""],
  ["Permit #", "text-center"],
  ["Status", ""],
  ["Asgn", "text-center"],
  ["Sub", "text-center"],
  ["Appr", "text-center"],
  ["Ord", "text-center"],
  ["ETA", "text-center"],
  ];

export function JobRowHeader() {
  return h(
    "div",
    { className: HEADER_CLASS },
    h("span", { key: "chevron" }),
    h("span", { key: "flag" }),
    ...COLUMNS.map(([label, cls]) => h("span", { key: label, className: cls }, label)),
    h("span", { key: "edit" }),
    );
}
