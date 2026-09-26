"use client";

import { startTransition, useActionState, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateMyTechIdentity } from "@/lib/actions/team";
import { useTechSlots } from "@/components/tech-slots-provider";

const NONE = "none";

// Lets the signed-in user tell PermitAIO which preset Permit Tech / HOA
// Tech label is theirs, so the dashboard's "My Jobs" view can match against
// jobs.permit_tech and hoa_jobs.assigned_to — those columns and their
// preset values are unchanged; this just links a login to one of them.
export function MyTechIdentityCard({
  permitTechLabel,
  hoaTechLabel,
}: {
  permitTechLabel: string | null;
  hoaTechLabel: string | null;
}) {
  const { permitTechs, hoaTechs } = useTechSlots();
  const [permitTech, setPermitTech] = useState(permitTechLabel ?? NONE);
  const [hoaTech, setHoaTech] = useState(hoaTechLabel ?? NONE);
  const [state, formAction, pending] = useActionState(updateMyTechIdentity, { error: null });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-heading">My tech identity</CardTitle>
        <CardDescription>
          Pick which permit tech and/or HOA tech you are so &ldquo;My Jobs&rdquo; on the
          dashboard shows just your work.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="permit_tech_label">Permit tech</Label>
            <Select value={permitTech} onValueChange={setPermitTech}>
              <SelectTrigger id="permit_tech_label"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not assigned</SelectItem>
                {permitTechs.map((tech) => (
                  <SelectItem key={tech} value={tech}>{tech}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="hoa_tech_label">HOA tech</Label>
            <Select value={hoaTech} onValueChange={setHoaTech}>
              <SelectTrigger id="hoa_tech_label"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not assigned</SelectItem>
                {hoaTechs.map((tech) => (
                  <SelectItem key={tech} value={tech}>{tech}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("permit_tech_label", permitTech);
              fd.set("hoa_tech_label", hoaTech);
              startTransition(() => formAction(fd));
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
        {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
        {!state.error && state.message && (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{state.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
