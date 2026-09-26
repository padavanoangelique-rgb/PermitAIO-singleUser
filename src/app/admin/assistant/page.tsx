import { AssistantIntake } from "./assistant-intake";

export default function AdminAssistantPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Phone assistant</h1>
        <p className="text-sm text-muted-foreground">
          Owner Console only. Not a company setting, and not on the public site.
        </p>
      </div>
      <AssistantIntake />
    </div>
  );
}
