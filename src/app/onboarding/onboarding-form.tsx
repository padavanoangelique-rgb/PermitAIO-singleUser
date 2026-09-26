"use client";

import { useActionState, useState } from "react";
import { createOrg } from "@/lib/actions/orgs";
import { joinOrgWithCode } from "@/lib/actions/join-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/logo";

export function OnboardingForm() {
  const [mode, setMode] = useState<"join" | "create">("join");
  const [createState, createAction, createPending] = useActionState(createOrg, {
    error: null,
  });
  const [joinState, joinAction, joinPending] = useActionState(joinOrgWithCode, {
    error: null,
  });

  return (
    <Card>
      <CardHeader>
        <Logo className="mb-2 h-8 w-8 text-primary" />
        <CardTitle className="font-heading">
          {mode === "join" ? "Join your company" : "Set up your company"}
        </CardTitle>
        <CardDescription>
          {mode === "join"
            ? "Type the company name and the join code from your admin. Your sign-in email must already be on that company's invite list."
            : "This creates a new workspace. You'll be the Owner and can invite your team afterward."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={mode === "join" ? "default" : "outline"} onClick={() => setMode("join")}>
            Join existing
          </Button>
          <Button type="button" variant={mode === "create" ? "default" : "outline"} onClick={() => setMode("create")}>
            Create new
          </Button>
        </div>

        {mode === "join" ? (
          <form action={joinAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company name</Label>
              <Input id="company" name="company" placeholder="Guardian" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Join code</Label>
              <Input id="code" name="code" placeholder="7K2M9Q" required autoCapitalize="characters" />
            </div>
            {joinState.error && <p className="text-sm text-destructive">{joinState.error}</p>}
            <Button type="submit" className="w-full" disabled={joinPending}>
              {joinPending ? "Joining…" : "Join company"}
            </Button>
          </form>
        ) : (
          <form action={createAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company name</Label>
              <Input id="name" name="name" placeholder="Acme Windows & Roofing" required />
            </div>
            {createState.error && <p className="text-sm text-destructive">{createState.error}</p>}
            <Button type="submit" className="w-full" disabled={createPending}>
              {createPending ? "Setting up…" : "Create workspace"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
