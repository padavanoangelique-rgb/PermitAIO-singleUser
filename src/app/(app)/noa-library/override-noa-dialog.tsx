"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertNoaOverride } from "@/lib/actions/noa";
import type { MergedNoaEntry } from "@/lib/noa/merge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

/**
 * Set (or clear) the current org's private pressure override on a
 * platform NOA row. Only the pressures are editable — every other
 * column is a shared platform value that org users can't change.
 * Saving with both fields empty deletes the override (returns to the
 * platform baseline).
 */
export function OverrideNoaDialog({ entry }: { entry: MergedNoaEntry }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<string>(
    entry.effective_pressure_pos != null ? String(entry.effective_pressure_pos) : "",
  );
  const [neg, setNeg] = useState<string>(
    entry.effective_pressure_neg != null ? String(entry.effective_pressure_neg) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPos(entry.effective_pressure_pos != null ? String(entry.effective_pressure_pos) : "");
    setNeg(entry.effective_pressure_neg != null ? String(entry.effective_pressure_neg) : "");
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await upsertNoaOverride(entry.id, pos, neg);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    const res = await upsertNoaOverride(entry.id, "", "");
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" /> Pressures
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Set your design pressures
          </DialogTitle>
          <DialogDescription>
            {entry.manufacturer}
            {entry.series ? ` — ${entry.series}` : ""} — NOA {entry.noa_number}.
            These pressures stay private to your company. Leave blank to fall
            back to the platform default.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="override-pos">Positive DP</Label>
            <Input
              id="override-pos"
              inputMode="decimal"
              value={pos}
              onChange={(e) => setPos(e.target.value)}
              placeholder={
                entry.base_pressure_pos != null
                  ? `Platform: +${entry.base_pressure_pos}`
                  : "Not set"
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="override-neg">Negative DP</Label>
            <Input
              id="override-neg"
              inputMode="decimal"
              value={neg}
              onChange={(e) => setNeg(e.target.value)}
              placeholder={
                entry.base_pressure_neg != null
                  ? `Platform: ${entry.base_pressure_neg}`
                  : "Not set"
              }
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {entry.has_override ? (
            <Button variant="ghost" onClick={handleClear} disabled={saving}>
              Clear override
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save pressures"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
