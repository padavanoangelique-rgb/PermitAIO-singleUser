"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteContractorProfile } from "@/lib/actions/contractors";

export function DeleteContractorButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => startTransition(() => deleteContractorProfile(id))}
    >
      <Trash2 className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}
