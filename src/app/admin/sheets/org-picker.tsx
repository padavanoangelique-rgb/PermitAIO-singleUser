"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function OrgPicker({
  orgs,
  selectedOrgId,
}: {
  orgs: { id: string; name: string }[];
  selectedOrgId: string | null;
}) {
  const router = useRouter();

  return (
    <Select
      value={selectedOrgId ?? undefined}
      onValueChange={(orgId) => router.push(`/admin/sheets?org=${orgId}`)}
    >
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Choose a company…" />
      </SelectTrigger>
      <SelectContent>
        {orgs.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
