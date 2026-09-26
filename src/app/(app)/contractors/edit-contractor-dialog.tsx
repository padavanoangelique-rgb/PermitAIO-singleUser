"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
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
import { updateContractorProfile } from "@/lib/actions/contractors";
import { ContractorFormFields } from "./contractor-form-fields";
import { ContractorDocsPanel } from "./contractor-docs-panel";
import type { Tables } from "@/lib/supabase/types";

type ContractorProfile = Tables<"contractor_profiles">;

export function EditContractorDialog({ profile }: { profile: ContractorProfile }) {
  const [open, setOpen] = useState(false);
  const boundAction = updateContractorProfile.bind(null, profile.id);
  const [state, formAction, pending] = useActionState(boundAction, { error: null });
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
        <Button variant="ghost" size="icon" aria-label={`Edit ${profile.company_name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form action={formAction} onSubmit={() => (submittedRef.current = true)}>
          <DialogHeader>
            <DialogTitle className="font-heading">Edit contractor profile</DialogTitle>
            <DialogDescription>
              These details are reused every time you generate permit forms
              for this contractor.
            </DialogDescription>
          </DialogHeader>
          <ContractorFormFields profile={profile} />
          {state.error && (
            <p className="mb-2 text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
        <ContractorDocsPanel contractorId={profile.id} orgId={profile.org_id} />
      </DialogContent>
    </Dialog>
  );
}
