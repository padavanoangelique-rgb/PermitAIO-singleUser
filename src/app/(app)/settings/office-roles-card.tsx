"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BTN_BLUE, FIELD, PILL } from "@/lib/ui/chrome";
import { OFFICE_ASSIGN_ROLES, type AssignedRoleRow } from "@/lib/assigned-roles";
import { assignOfficeRole } from "./assign-office-role";

const ROLE_LABEL = Object.fromEntries(OFFICE_ASSIGN_ROLES.map((r) => [r.value, r.label]));

export function OfficeRolesCard({
  roster,
  permitSlots,
  hoaSlots,
}: {
  roster: AssignedRoleRow[];
  permitSlots: string[];
  hoaSlots: string[];
}) {
  const [role, setRole] = useState("permit_tech");
  const office = roster.filter((r) => OFFICE_ASSIGN_ROLES.some((o) => o.value === r.role));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Office apps</CardTitle>
        <CardDescription>
          Permit tech, HOA tech, Measure, Sales, Warehouse. Assign here first. They go to permitaio.com/join and create a password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {office.length === 0 ? (
          <p className="text-sm text-muted-foreground">None assigned yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {office.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{m.email}</span>
                <span className={PILL}>
                  {ROLE_LABEL[m.role] ?? m.role}
                  {m.tech_slot ? ` · ${m.tech_slot}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form action={assignOfficeRole} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
          <label className="text-xs sm:col-span-2">
            Email
            <input name="email" type="email" required className={FIELD} />
          </label>
          <label className="text-xs">
            Role
            <select name="role" className={FIELD} value={role} onChange={(e) => setRole(e.target.value)}>
              {OFFICE_ASSIGN_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {role === "permit_tech" ? (
            <label className="text-xs">
              Desk
              <select name="slot" className={FIELD} required>
                {permitSlots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {role === "hoa_tech" ? (
            <label className="text-xs">
              Desk
              <select name="slot" className={FIELD} required>
                {hoaSlots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button className={`${BTN_BLUE} sm:col-span-2`} type="submit">
            Assign role
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
