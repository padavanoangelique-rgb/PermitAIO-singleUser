import { GrokManagerCard } from "@/components/settings/grok-manager-card";

export default function AdminXenaPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Xena — Warrior Manager</h1>
        <p className="text-sm text-muted-foreground">
          You run her. Companies do not. Feed reports, see the desks, and keep the instructions in the
          workbook.
        </p>
      </div>
      <GrokManagerCard slug="guardian" />
    </div>
  );
}
