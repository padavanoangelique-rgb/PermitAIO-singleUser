"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { joinOrgOpenRole } from "@/lib/actions/join-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TeamSignUpForm({ role, company, code }: { role: string; company: string; code: string }) {
  const [state, action, pending] = useActionState(signUp, { error: null });
  const next = `/join/team?role=${encodeURIComponent(role)}&company=${encodeURIComponent(company)}&code=${encodeURIComponent(code)}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Step 1 — Create your account</CardTitle>
        <CardDescription>Use your own work email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <Input type="email" name="email" placeholder="Email" required />
          <Input type="password" name="password" placeholder="Password (8+ characters)" required minLength={8} />
          <Input type="password" name="confirmPassword" placeholder="Confirm password" required minLength={8} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Already have a PermitAIO account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
          , then come back to this page.
        </p>
      </CardContent>
    </Card>
  );
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "permit_tech", label: "Permit Tech" },
  { value: "hoa_tech", label: "HOA Tech" },
  { value: "manager", label: "Manager" },
  { value: "account_manager", label: "Account Manager" },
  { value: "project_manager", label: "Project Manager" },
  { value: "installer", label: "Installer" },
  { value: "runner", label: "Permit Runner" },
  { value: "service_tech", label: "Service Tech" },
];

export function TeamCodeForm({
  email,
  role,
  company,
  code,
}: {
  email: string;
  role: string;
  company: string;
  code: string;
}) {
  const [state, action, pending] = useActionState(joinOrgOpenRole, { error: null });
  const [selectedRole, setSelectedRole] = useState(role);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Step 2 — Join your company</CardTitle>
        <CardDescription>
          Signed in as {email}. Enter your company&apos;s name and join code, then pick your role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="role" value={selectedRole} />
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
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your role</p>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((r) => {
                const active = selectedRole === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={
                      active
                        ? "rounded-md border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                        : "rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                    }
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending || !selectedRole}>
            {pending ? "Joining…" : "Join company"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          You&apos;ll get in right away — an admin confirms your role in Settings shortly after.
        </p>
      </CardContent>
    </Card>
  );
}
