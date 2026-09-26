import { removeInstallMember } from "@/app/(app)/install/actions";
import { Button } from "@/components/ui/button";

export function RemoveInstallMemberButton({ id }: { id: string }) {
  return (
    <form action={removeInstallMember}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs text-destructive">
        Remove
      </Button>
    </form>
  );
}
