"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateMemberRole } from "@/lib/actions/team";
import type { MemberRole } from "@/lib/data/orgs";

const ROLES: MemberRole[] = ["owner", "admin", "accounting", "manager", "member"];

// Owner-only role editor rendered inline in the team table. The real
// security boundary is the trg_protect_member_role DB trigger — this UI is
// only shown to the owner, and the update below will simply fail (with a
// friendly message) if that ever changes out from under the page.
export function MemberRoleSelect({
  memberId,
  currentRole,
}: {
  memberId: string;
  currentRole: MemberRole;
}) {
  const [role, setRole] = useState<MemberRole>(currentRole);
  const [state, formAction] = useActionState(updateMemberRole, { error: null });

  useEffect(() => {
    if (state.error) setRole(currentRole);
  }, [state.error, currentRole]);

  function handleChange(next: string) {
    setRole(next as MemberRole);
    const formData = new FormData();
    formData.set("member_id", memberId);
    formData.set("role", next);
    formAction(formData);
  }

  return (
    <div className="flex flex-col gap-1">
      <Select value={role} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[140px] text-xs capitalize"><SelectValue /></SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {state.error && <p className="text-[11px] text-destructive">{state.error}</p>}
    </div>
  );
}
