"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/ui/date-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface NoaFieldsState {
  manufacturer: string;
  windowType: string;
  series: string;
  modelNumber: string;
  noaNumber: string;
  trade: string;
  pressurePos: string;
  pressureNeg: string;
  effectiveDate: string;
  expirationDate: string;
  notes: string;
}

/** Options for the Window Type column. Kept short so the dropdown fits the row. */
const WINDOW_TYPE_OPTIONS = [
  "Single Hung",
  "Double Hung",
  "Casement",
  "Awning",
  "Horizontal Roller",
  "Fixed / Picture",
  "Sliding Glass Door",
  "Swing Door",
  "Entry Door",
  "French Door",
  "Mullion",
  "Skylight",
  "Storefront",
];

export function NoaFields({
  idPrefix,
  state,
  onChange,
}: {
  idPrefix: string;
  state: NoaFieldsState;
  onChange: (next: Partial<NoaFieldsState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-manufacturer`}>Manufacturer</Label>
          <Input
            id={`${idPrefix}-manufacturer`}
            value={state.manufacturer}
            onChange={(e) => onChange({ manufacturer: e.target.value })}
            placeholder="e.g. PGT"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-window-type`}>Window type</Label>
          <Select
            value={state.windowType}
            onValueChange={(v) => onChange({ windowType: v })}
          >
            <SelectTrigger id={`${idPrefix}-window-type`} className="w-full">
              <SelectValue placeholder="Choose window/door type" />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-series`}>Series</Label>
          <Input
            id={`${idPrefix}-series`}
            value={state.series}
            onChange={(e) => onChange({ series: e.target.value })}
            placeholder="e.g. WinGuard 5500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-model`}>Model #</Label>
          <Input
            id={`${idPrefix}-model`}
            value={state.modelNumber}
            onChange={(e) => onChange({ modelNumber: e.target.value })}
            placeholder="e.g. SH-7100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-noa`}>NOA / FL# number</Label>
          <Input
            id={`${idPrefix}-noa`}
            value={state.noaNumber}
            onChange={(e) => onChange({ noaNumber: e.target.value })}
            placeholder="e.g. FL16319.3 or 23-1027.09"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Applies to</Label>
          <Select value={state.trade} onValueChange={(v) => onChange({ trade: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">All trades</SelectItem>
              <SelectItem value="windows">Windows only</SelectItem>
              <SelectItem value="roofing">Roofing only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-pos`}>Design pressure + (PSF)</Label>
          <Input
            id={`${idPrefix}-pos`}
            type="number"
            step="0.1"
            value={state.pressurePos}
            onChange={(e) => onChange({ pressurePos: e.target.value })}
            placeholder="e.g. 55"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-neg`}>Design pressure &minus; (PSF)</Label>
          <Input
            id={`${idPrefix}-neg`}
            type="number"
            step="0.1"
            value={state.pressureNeg}
            onChange={(e) => onChange({ pressureNeg: e.target.value })}
            placeholder="e.g. -70"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <DateField
            label="Effective date (optional)"
            value={state.effectiveDate || null}
            onSave={(next) => onChange({ effectiveDate: next ?? "" })}
          />
        </div>
        <div className="space-y-1.5">
          <DateField
            label="Expiration date (optional)"
            value={state.expirationDate || null}
            onSave={(next) => onChange({ expirationDate: next ?? "" })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>Notes (optional)</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={state.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Anything your team should know about this approval."
          rows={2}
        />
      </div>
    </div>
  );
}
