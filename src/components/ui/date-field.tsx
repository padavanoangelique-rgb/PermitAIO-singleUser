"use client";

import { useRef, useState } from "react";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

export function DateField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (next: string | null) => void;
}) {
  const stored = toDateOnly(value);
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const display = (() => {
    if (!stored) return "";
    const [y, m, d] = stored.split("-");
    return y && m && d ? `${m}/${d}/${y}` : stored;
  })();
  const shown = draft !== "" ? draft : display;

  function parse(text: string): string | null | false {
    const t = text.trim();
    if (!t) return null;
    let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
      const mo = Number(m[1]);
      const dd = Number(m[2]);
      if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return false;
      return `${yr}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const mo = Number(m[2]);
      const dd = Number(m[3]);
      if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return false;
      return `${m[1]}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    return false;
  }

  function commit() {
    if (draft === "") return;
    const parsed = parse(draft);
    setDraft("");
    if (parsed === false) return;
    if ((parsed ?? null) !== (stored || null)) onSave(parsed);
  }

  return (
    <div className="min-w-0">
      <label className="block truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground" title={label}>{label}</label>
      <div className="relative mt-1">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="mm/dd/yyyy"
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft("");
          }}
          className="h-8 pr-11 pl-2 text-xs"
        />
        <div className="absolute top-0 right-0.5 flex h-8 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={`Pick ${label.toLowerCase()} date`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              const el = pickerRef.current;
              if (!el) return;
              if (typeof el.showPicker === "function") el.showPicker();
              else el.click();
            }}
          >
            <Calendar />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={`Clear ${label.toLowerCase()} date`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              setDraft("");
              if (stored) onSave(null);
            }}
          >
            <X />
          </Button>
        </div>
        <input
          ref={pickerRef}
          type="date"
          value={stored}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            if (next !== stored) onSave(next);
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
        />
      </div>
    </div>
  );
}
