"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeMember } from "@/lib/actions/members";

export function RemoveMemberButton({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(removeMember, { error: null });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
  }, [state.error, state.message]);

  return (
    <form action={formAction}>
      <input type="hidden" name="member_id" value={memberId} />
      <Button type="submit" variant="ghost" size="sm" className="text-destructive" disabled={pending}>
        {pending ? "Removing…" : "Delete"}
      </Button>
    </form>
  );
}
