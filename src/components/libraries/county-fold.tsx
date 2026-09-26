"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { FILL_PURPLE } from "@/lib/ui/fills";

export const LIB_PILL =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm";
export const LIB_ROW =
  "flex w-full flex-wrap items-center gap-2 rounded-2xl px-2 py-2 text-left hover:bg-muted/40";
export const LIB_SEARCH =
  "h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm";

export function LibrarySearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={LIB_SEARCH} />
    </div>
  );
}

export function CountyFold({
  title,
  countLabel,
  open,
  onToggle,
  children,
  tone = FILL_PURPLE,
}: {
  title: string;
  countLabel: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <section>
      <button type="button" onClick={onToggle} className={LIB_ROW}>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className={`${LIB_PILL} ${tone}`}>{title}</span>
        <span className="text-sm text-muted-foreground">{countLabel}</span>
      </button>
      {open ? <div className="space-y-1 pl-3">{children}</div> : null}
    </section>
  );
}
