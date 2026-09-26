"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { joinOrgWithCode } from "@/lib/actions/join-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InstallSignUpForm({ company, code }: { company: string; code: string }) {
  const [state, action, pending] = useActionState(signUp, { error: null });
  const next = company || code ? `/join/install?company=${encodeURIComponent(company)}&code=${encodeURIComponent(code)}` : "";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Step 1 — Create your account</CardTitle>
        <CardDescription>Use the same email your Install Manager already has on file for you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Input type="email" name="email" placeholder="Email" required />
          <Input type="password" name="password" placeholder="Password (8+ characters)" required minLength={8} />
          <Input type="password" name="confirmPassword" placeholder="Confirm password" required minLength={8} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
        {next ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Your company and join code are already filled in on the next step.
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            After creating your account you&apos;ll land on a setup page — pick{" "}
            <span className="font-medium text-foreground">Join a company</span> there and enter the same name and
            code.
          </p>
        )}
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Already have a PermitAIO account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next || "/join/install")}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
          , then come back to this page.
        </p>
      </CardContent>
    </Card>
  );
}

export function InstallCodeForm({ email, company, code }: { email: string; company: string; code: string }) {
  const [state, action, pending] = useActionState(joinOrgWithCode, { error: null });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Step 2 — Join your company</CardTitle>
        <CardDescription>Signed in as {email}. Enter your company&apos;s name and join code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <Input type="text" name="company" placeholder="Company name" required minLength={3} defaultValue={company} />
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
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Once you&apos;re in, look for <span className="font-medium text-foreground">Install</span> in the nav to
          reach your jobs.
        </p>
      </CardContent>
    </Card>
  );
}
