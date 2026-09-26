"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createContractorProfile } from "@/lib/actions/contractors";
import { ContractorFormFields } from "./contractor-form-fields";

export function NewContractorDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createContractorProfile,
    { error: null },
  );
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !pending && !state.error) {
      submittedRef.current = false;
      setOpen(false);
    }
  }, [pending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground">
          <Plus />
          Add contractor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} onSubmit={() => (submittedRef.current = true)}>
          <DialogHeader>
            <DialogTitle className="font-heading">Add a contractor profile</DialogTitle>
            <DialogDescription>
              Save contractor details once and pick from the dropdown when
              generating permit forms.
            </DialogDescription>
          </DialogHeader>
          <ContractorFormFields />
          {state.error && (
            <p className="mb-2 text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save contractor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
