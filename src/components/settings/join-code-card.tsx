"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setJoinCode } from "@/lib/actions/join-org";

export function JoinCodeCard({ code }: { code: string | null }) {
  const [state, formAction, pending] = useActionState(setJoinCode, { error: null });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
  }, [state.error, state.message]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-heading">Join code</CardTitle>
        <CardDescription>
          Unique 4-digit code for this company. After you assign someone in Settings, they go to permitaio.com/join, enter this code, and create their own password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex items-center gap-3">
          <Input
            name="code"
            inputMode="numeric"
            maxLength={4}
            defaultValue={code ?? ""}
            placeholder="4660"
            className="font-mono text-lg tracking-widest max-w-[120px]"
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save code"}
          </Button>
          <a
            href="/api/join/sign-in-sheet"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm"
          >
            Print sign-in sheet
          </a>
        </form>
      </CardContent>
    </Card>
  );
}
