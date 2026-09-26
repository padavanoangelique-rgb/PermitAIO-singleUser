"use client";

import { useActionState } from "react";
import Link from "next/link";
import { joinAssigned } from "@/lib/actions/join-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AssignedJoinForm({ company, code }: { company: string; code: string }) {
  const [state, action, pending] = useActionState(joinAssigned, { error: null });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Join your company</CardTitle>
        <CardDescription>
          Your manager already assigned your role. Use the same email they put in Settings, pick a password, enter the company code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company name</Label>
            <Input id="company" name="company" placeholder="Company name" required minLength={3} defaultValue={company} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">4-digit company code</Label>
            <Input
              id="code"
              name="code"
              placeholder="4660"
              required
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              defaultValue={code}
              className="font-mono tracking-widest"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Your work email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Create a password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="8+ characters"
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Joining…" : "Create password and join"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
