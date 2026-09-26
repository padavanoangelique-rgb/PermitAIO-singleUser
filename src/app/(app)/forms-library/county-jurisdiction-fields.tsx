"use client";

import { FORM_COUNTIES, type FormCounty } from "@/lib/forms/folio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const COUNTY_WIDE = "__county_wide__";

export interface JurisdictionOption {
  code: string;
  jurisdiction_name: string | null;
}

/** Shared county + municipality picker used by both the "Add form" and "Edit form" dialogs. */
export function CountyJurisdictionFields({
  county,
  jurisdiction,
  onCountyChange,
  onJurisdictionChange,
  jurisdictionsByCounty,
}: {
  county: FormCounty;
  jurisdiction: string;
  onCountyChange: (county: FormCounty) => void;
  onJurisdictionChange: (jurisdiction: string) => void;
  jurisdictionsByCounty: Record<FormCounty, JurisdictionOption[]>;
}) {
  const options = jurisdictionsByCounty[county] ?? [];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>County</Label>
        <Select value={county} onValueChange={(v) => onCountyChange(v as FormCounty)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORM_COUNTIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Municipality</Label>
        <Select value={jurisdiction} onValueChange={onJurisdictionChange} disabled={options.length === 0}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={COUNTY_WIDE}>County-wide (all municipalities)</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.code} value={o.code}>
                {o.jurisdiction_name ?? o.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {options.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {county} folio numbers don&apos;t encode a municipality — this form
            always applies county-wide.
          </p>
        )}
      </div>
    </div>
  );
}
