"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTechName } from "@/lib/actions/tech-names";
import { useTechSlots } from "@/components/tech-slots-provider";
import type { TechKind, TechNameMap } from "@/lib/tech-labels";

type Section = { kind: TechKind; title: string; slots: readonly string[]; hint: string };

export function TechNamesCard({
  canEdit,
  initialPermit,
  initialHoa,
}: {
  canEdit: boolean;
  initialPermit: TechNameMap;
  initialHoa: TechNameMap;
}) {
  const { permitTechs, hoaTechs } = useTechSlots();

  const sections: readonly Section[] = [
    {
      kind: "permit",
      title: "Permit Techs",
      slots: permitTechs,
      hint: "Names shown next to each permit tech slot across Permit Inventory (filter chips, dashboard, reports).",
    },
    {
      kind: "hoa",
      title: "HOA Techs",
      slots: hoaTechs,
      hint: "Names shown next to each HOA tech slot across HOA Tracker (filter chips, job list, reports).",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-heading">Team tech names</CardTitle>
        <CardDescription>
          Give each tech slot a real technician&apos;s name for the whole org. The slot
          label stays the same everywhere; the real name is shown alongside it (e.g. &ldquo;Tech 1
          (Thamara)&rdquo;). Existing job assignments are not affected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {sections.map((section) => (
          <TechSection
            key={section.kind}
            section={section}
            canEdit={canEdit}
            initial={section.kind === "permit" ? initialPermit : initialHoa}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function TechSection({
  section,
  canEdit,
  initial,
}: {
  section: Section;
  canEdit: boolean;
  initial: TechNameMap;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{section.title}</h3>
        <p className="text-xs text-muted-foreground">{section.hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {section.slots.map((slot) => (
          <TechSlotField
            key={slot}
            kind={section.kind}
            slot={slot}
            canEdit={canEdit}
            initialName={initial[slot] ?? ""}
          />
        ))}
      </div>
    </div>
  );
}

function TechSlotField({
  kind,
  slot,
  canEdit,
  initialName,
}: {
  kind: TechKind;
  slot: string;
  canEdit: boolean;
  initialName: string;
}) {
  const [value, setValue] = useState(initialName);
  const [savedValue, setSavedValue] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = value.trim() !== savedValue.trim();

  const onSave = () => {
    if (!canEdit || !dirty) return;
    setError(null);
    startTransition(async () => {
      const res = await saveTechName(kind, slot, value);
      if (res.ok) {
        setSavedValue(value.trim());
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1600);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{slot}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          disabled={!canEdit || pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
          }}
          placeholder="Add real name"
          maxLength={80}
        />
        <Button
          type="button"
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={!canEdit || !dirty || pending}
          onClick={onSave}
          className="shrink-0"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : justSaved ? <Check className="h-4 w-4" /> : "Save"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!canEdit && (
        <p className="text-xs text-muted-foreground">Only owners and admins can rename techs.</p>
      )}
    </div>
  );
}
