"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salesSelfServeJoin, salesJoinWithCode } from "@/lib/actions/sales-join";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SalesSignUpForm({ code = "" }: { code?: string }) {
  const [state, action, pending] = useActionState(salesSelfServeJoin, { error: null });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Join your sales team</CardTitle>
        <CardDescription>Enter your email, your company&apos;s 4-digit join code, and pick a password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <Input type="email" name="email" placeholder="Email" required />
          <Input
            type="text"
            name="code"
            placeholder="4-digit join code"
            required
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            defaultValue={code}
          />
          <Input type="password" name="password" placeholder="Password (8+ characters)" required minLength={8} />
          <Input type="password" name="confirmPassword" placeholder="Confirm password" required minLength={8} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Joining…" : "Join company"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have a PermitAIO account?{" "}
          <Link href={`/login?next=${encodeURIComponent(`/join/sales${code ? `?code=${code}` : ""}`)}`} className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
          , then come back to this page.
        </p>
      </CardContent>
    </Card>
  );
}

export function SalesCodeForm({ email, code = "" }: { email: string; code?: string }) {
  const [state, action, pending] = useActionState(salesJoinWithCode, { error: null });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Join your company</CardTitle>
        <CardDescription>Signed in as {email}. Enter your company&apos;s join code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <Input
            type="text"
            name="code"
            placeholder="4-digit join code"
            required
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            defaultValue={code}
          />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Joining…" : "Join company"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
