"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateNoaEntry } from "@/lib/actions/noa";
import type { MergedNoaEntry } from "@/lib/noa/merge";
import { NoaFields, type NoaFieldsState } from "./noa-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

function toState(entry: MergedNoaEntry): NoaFieldsState {
  // Editing the entry itself always operates on the base (platform)
  // pressures — org-private pressure overrides live in a separate table.
  return {
    manufacturer: entry.manufacturer,
    windowType: entry.window_type ?? "",
    series: entry.series ?? "",
    modelNumber: entry.model_number ?? "",
    noaNumber: entry.noa_number,
    trade: entry.trade,
    pressurePos:
      entry.base_pressure_pos != null ? String(entry.base_pressure_pos) : "",
    pressureNeg:
      entry.base_pressure_neg != null ? String(entry.base_pressure_neg) : "",
    effectiveDate: entry.effective_date ?? "",
    expirationDate: entry.expiration_date ?? "",
    notes: entry.notes ?? "",
  };
}

/**
 * Edit an NOA row. Only rendered when `entry.can_edit_entry` is true, so
 * we assume the caller is either a platform admin (editing any row) or
 * an org member editing a row their own org owns.
 *
 * Admins additionally see a "Publish to platform" toggle so they can
 * promote an org row to the shared catalog (or in principle demote one,
 * though the flow is really about publishing).
 */
export function EditNoaDialog({
  entry,
  isAdmin,
}: {
  entry: MergedNoaEntry;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NoaFieldsState>(() => toState(entry));
  const [publishToPlatform, setPublishToPlatform] = useState<boolean>(
    entry.visibility === "platform",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setState(toState(entry));
    setPublishToPlatform(entry.visibility === "platform");
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await updateNoaEntry(entry.id, {
      manufacturer: state.manufacturer,
      windowType: state.windowType,
      series: state.series,
      modelNumber: state.modelNumber,
      noaNumber: state.noaNumber,
      trade: state.trade,
      pressurePos: state.pressurePos,
      pressureNeg: state.pressureNeg,
      effectiveDate: state.effectiveDate || null,
      expirationDate: state.expirationDate || null,
      notes: state.notes,
      // Visibility change is admin-only; the action ignores this for
      // non-admins anyway, but we don't send it for org users to keep
      // the update payload minimal.
      ...(isAdmin ? { visibility: publishToPlatform ? "platform" : "org" } : {}),
    });
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
        <Button variant="ghost" size="sm" title="Edit this NOA">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit NOA</DialogTitle>
          <DialogDescription>
            {entry.visibility === "platform"
              ? "This NOA lives in the shared platform library — every org sees it."
              : "This NOA is private to your organization."}
          </DialogDescription>
        </DialogHeader>

        <NoaFields
          idPrefix={`edit-noa-${entry.id}`}
          state={state}
          onChange={(next) => setState((s) => ({ ...s, ...next }))}
        />

        {isAdmin && (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id={`edit-noa-${entry.id}-publish`}
              checked={publishToPlatform}
              onCheckedChange={(v) => setPublishToPlatform(v === true)}
            />
            <div className="space-y-0.5">
              <Label
                htmlFor={`edit-noa-${entry.id}-publish`}
                className="text-sm font-medium"
              >
                Publish to platform library
              </Label>
              <p className="text-xs text-muted-foreground">
                When on, every org sees this NOA. Turn off to move it back to
                private for its original org.
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={saving || !state.manufacturer.trim() || !state.noaNumber.trim()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
