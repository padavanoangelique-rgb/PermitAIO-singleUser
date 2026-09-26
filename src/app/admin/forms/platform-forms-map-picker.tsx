"use client";

import { useState } from "react";
import { FieldMappingDialog } from "./field-mapping-dialog";
import type { PlatformFormRow } from "./platform-forms-manager";
import { Label } from "@/components/ui/label";

export function PlatformFormsMapPicker({ rows }: { rows: PlatformFormRow[] }) {
  const [id, setId] = useState("");
  const selected = rows.find((r) => r.id === id) ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-3">
      <Label className="text-xs uppercase text-muted-foreground">
        Map PDF fields to job data
      </Label>
      <p className="text-xs text-muted-foreground">
        Pick a form, auto-guess name/address/folio, then save. Typed once on the
        job, filled on every mapped box in the package.
      </p>
      <select
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        <option value="">Choose a form…</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.county}
            {r.jurisdiction_name ? ` / ${r.jurisdiction_name}` : " / county-wide"} — {r.title}
            {r.file_name ? "" : " (no file)"}
          </option>
        ))}
      </select>
      <FieldMappingDialog
        formId={selected?.id ?? null}
        title={selected?.title ?? ""}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setId("");
        }}
      />
    </div>
  );
}
