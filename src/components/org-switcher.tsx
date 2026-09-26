"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchOrg } from "@/lib/actions/orgs";
import type { OrgMembership } from "@/lib/data/orgs";

export function OrgSwitcher({
  memberships,
  activeSlug,
}: {
  memberships: OrgMembership[];
  activeSlug: string;
}) {
  const [pending, startTransition] = useTransition();

  if (memberships.length <= 1) {
    return (
      <p className="truncate px-2 text-sm font-medium text-sidebar-foreground">
        {memberships[0]?.organizations.name}
      </p>
    );
  }

  return (
    <Select
      value={activeSlug}
      disabled={pending}
      onValueChange={(slug) => startTransition(() => switchOrg(slug))}
    >
      <SelectTrigger className="w-full bg-sidebar-accent text-sidebar-foreground">
        <SelectValue placeholder="Select company" />
      </SelectTrigger>
      <SelectContent>
        {memberships.map((m) => (
          <SelectItem key={m.org_id} value={m.organizations.slug}>
            {m.organizations.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
