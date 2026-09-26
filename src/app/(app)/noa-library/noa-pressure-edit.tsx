"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateNoaEntry, upsertNoaOverride } from "@/lib/actions/noa";
import type { MergedNoaEntry } from "@/lib/noa/merge";

function asText(value: number | null): string {
  return value != null ? String(value) : "";
}

function cleanPressure(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

/**
 * Positive and negative design pressure, edited on the row.
 * Platform NOAs save a private company override. Company-owned NOAs
 * write the row itself. Blank both fields on a platform NOA to go
 * back to the shared numbers.
 */
export function NoaPressureEdit({ entry }: { entry: MergedNoaEntry }) {
  const router = useRouter();
  const savedPos = asText(entry.effective_pressure_pos);
  const savedNeg = asText(entry.effective_pressure_neg);
  const [pos, setPos] = useState(savedPos);
  const [neg, setNeg] = useState(savedNeg);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPos(savedPos);
    setNeg(savedNeg);
  }, [savedPos, savedNeg]);

  const editable = entry.visibility === "platform" ? entry.can_override : entry.can_edit_entry;

  async function save() {
    if (!editable || saving) return;
    const nextPos = cleanPressure(pos);
    const nextNeg = cleanPressure(neg);
    if (nextPos == null || nextNeg == null) {
      setError("Pressures have to be numbers.");
      return;
    }
    const curPos = cleanPressure(savedPos) ?? "";
    const curNeg = cleanPressure(savedNeg) ?? "";
    if (nextPos === curPos && nextNeg === curNeg) {
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    const res =
      entry.visibility === "platform"
        ? await savePlatformPressures(entry, nextPos, nextNeg)
        : await updateNoaEntry(entry.id, {
            manufacturer: entry.manufacturer,
            windowType: entry.window_type ?? "",
            series: entry.series ?? "",
            modelNumber: entry.model_number ?? "",
            noaNumber: entry.noa_number,
            trade: entry.trade,
            pressurePos: nextPos,
            pressureNeg: nextNeg,
            effectiveDate: entry.effective_date,
            expirationDate: entry.expiration_date,
            notes: entry.notes ?? "",
          });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  if (!editable) {
    return (
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {savedPos || savedNeg ? `+${savedPos || "—"} / ${savedNeg || "—"}` : "—"}
      </span>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      title={
        error ??
        (entry.has_override
          ? "Your company’s pressures. Clear both and click away to use the shared numbers."
          : "Type a pressure and click away to save.")
      }
    >
      <PressureBox
        label="Positive"
        sign="+"
        value={pos}
        disabled={saving}
        yours={entry.has_override}
        onChange={setPos}
        onCommit={save}
      />
      <span className="text-xs text-muted-foreground">/</span>
      <PressureBox
        label="Negative"
        sign="−"
        value={neg}
        disabled={saving}
        yours={entry.has_override}
        onChange={setNeg}
        onCommit={save}
      />
    </div>
  );
}

function PressureBox({
  label,
  sign,
  value,
  disabled,
  yours,
  onChange,
  onCommit,
}: {
  label: string;
  sign: string;
  value: string;
  disabled: boolean;
  yours: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label} design pressure</span>
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {sign}
      </span>
      <input
        inputMode="decimal"
        aria-label={`${label} design pressure`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className={`h-8 w-[4.5rem] rounded-full border bg-background pl-5 pr-2 text-sm tabular-nums outline-none focus:border-primary ${
          yours ? "border-emerald-600" : "border-border"
        }`}
      />
    </label>
  );
}

async function savePlatformPressures(entry: MergedNoaEntry, pos: string, neg: string) {
  const basePos = asText(entry.base_pressure_pos);
  const baseNeg = asText(entry.base_pressure_neg);
  const backToShared =
    (cleanPressure(pos) ?? "") === (cleanPressure(basePos) ?? "") &&
    (cleanPressure(neg) ?? "") === (cleanPressure(baseNeg) ?? "");
  if (backToShared) return upsertNoaOverride(entry.id, "", "");
  return upsertNoaOverride(entry.id, pos, neg);
}
