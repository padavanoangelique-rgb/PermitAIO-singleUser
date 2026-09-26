"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNoaEntry } from "@/lib/actions/noa";
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
import { Plus } from "lucide-react";

const EMPTY: NoaFieldsState = {
  manufacturer: "",
  windowType: "",
  series: "",
  modelNumber: "",
  noaNumber: "",
  trade: "windows",
  pressurePos: "",
  pressureNeg: "",
  effectiveDate: "",
  expirationDate: "",
  notes: "",
};

/**
 * Add a new NOA. Platform admins may publish to the shared library by
 * checking "Publish to platform library"; everyone else's NOAs are
 * private to their organization.
 */
export function NewNoaDialog({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NoaFieldsState>(EMPTY);
  // Default to platform when the author is an admin — that's the whole
  // reason they logged in as admin instead of just their normal user.
  const [publishToPlatform, setPublishToPlatform] = useState<boolean>(isAdmin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setState(EMPTY);
    setPublishToPlatform(isAdmin);
    setError(null);
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const res = await createNoaEntry({
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
      visibility: isAdmin && publishToPlatform ? "platform" : "org",
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    reset();
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
        <Button size="sm">
          <Plus className="h-3.5 w-3.5" /> Add NOA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Add a Notice of Acceptance
          </DialogTitle>
          <DialogDescription>
            Create the entry, then upload its PDF from the library list. It
            will automatically match any job whose window/door schedule uses
            this manufacturer and series.
          </DialogDescription>
        </DialogHeader>

        <NoaFields
          idPrefix="new-noa"
          state={state}
          onChange={(next) => setState((s) => ({ ...s, ...next }))}
        />

        {isAdmin ? (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="new-noa-publish"
              checked={publishToPlatform}
              onCheckedChange={(v) => setPublishToPlatform(v === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="new-noa-publish" className="text-sm font-medium">
                Publish to platform library
              </Label>
              <p className="text-xs text-muted-foreground">
                Every org will see this NOA in their library. Uncheck to keep
                it private to your organization.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This NOA will be private to your company — nobody outside your
            organization will see it.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={saving || !state.manufacturer.trim() || !state.noaNumber.trim()}
          >
            {saving ? "Creating…" : "Create NOA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
