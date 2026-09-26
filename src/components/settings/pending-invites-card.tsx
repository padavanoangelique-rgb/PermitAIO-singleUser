"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revokeInvite } from "@/lib/actions/invites";
import type { OrgInvite } from "@/lib/data/invites";

function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState(revokeInvite, { error: null });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
  }, [state.error, state.message]);

  return (
    <form action={formAction}>
      <input type="hidden" name="invite_id" value={inviteId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel"}
      </Button>
    </form>
  );
}

export function PendingInvitesCard({ invites }: { invites: OrgInvite[] }) {
  if (invites.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-heading">Pending invites</CardTitle>
        <CardDescription>
          Invited teammates who haven&apos;t joined yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {invites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{inv.email}</span>
              <Badge variant="outline" className="ml-2 capitalize">
                {inv.role}
              </Badge>
            </div>
            <CancelInviteButton inviteId={inv.id} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
