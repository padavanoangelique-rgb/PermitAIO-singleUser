"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvite, declineInvite } from "@/lib/actions/invites";
import type { PendingInvite } from "@/lib/data/invites";

function InviteRow({ invite }: { invite: PendingInvite }) {
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptInvite, {
    error: null,
  });
  const [declineState, declineAction, declinePending] = useActionState(declineInvite, {
    error: null,
  });

  useEffect(() => {
    if (acceptState.error) toast.error(acceptState.error);
  }, [acceptState.error]);
  useEffect(() => {
    if (declineState.error) toast.error(declineState.error);
    if (declineState.message) toast.success(declineState.message);
  }, [declineState.error, declineState.message]);

  const orgName = invite.organizations?.name ?? "an organization";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Mail className="h-4 w-4 text-primary" />
        <span>
          You&apos;ve been invited to join <span className="font-medium">{orgName}</span> as{" "}
          <span className="font-medium capitalize">{invite.role}</span>.
        </span>
      </div>
      <div className="flex gap-2">
        <form action={declineAction}>
          <input type="hidden" name="invite_id" value={invite.id} />
          <Button type="submit" variant="ghost" size="sm" disabled={declinePending}>
            Decline
          </Button>
        </form>
        <form action={acceptAction}>
          <input type="hidden" name="invite_id" value={invite.id} />
          <Button type="submit" size="sm" disabled={acceptPending}>
            {acceptPending ? "Joining…" : "Accept"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function PendingInvitesBanner({ invites }: { invites: PendingInvite[] }) {
  if (invites.length === 0) return null;

  return (
    <div className="space-y-2">
      {invites.map((invite) => (
        <InviteRow key={invite.id} invite={invite} />
      ))}
    </div>
  );
}
