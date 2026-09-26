"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { reportInviteEvent } from "../actions";

type Step = "loading" | "set-password" | "error";

export default function AcceptInvitePage() {
  const [step, setStep] = useState<Step>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setErrorMessage(
          "This invite link is invalid or has expired. Ask whoever invited you to send a new one.",
        );
        setStep("error");
        return;
      }
      const email = data.session.user.email ?? null;
      setInviteEmail(email);
      setStep("set-password");
      void reportInviteEvent("opened", email);
    });
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    void reportInviteEvent("password_set", inviteEmail);
    window.location.href = "/dashboard";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <Logo className="mb-2 h-8 w-8 text-primary" />
            <CardTitle className="font-heading">
              {step === "set-password" ? "Welcome to PermitAIO" : "Joining your team"}
            </CardTitle>
            <CardDescription>
              {step === "loading" && "Confirming your invite…"}
              {step === "set-password" &&
                "You've been added to the team. Set a password to finish signing in."}
              {step === "error" && errorMessage}
            </CardDescription>
          </CardHeader>
          {step === "set-password" && (
            <CardContent>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Saving…" : "Set password & continue"}
                </Button>
              </form>
            </CardContent>
          )}
          {step === "error" && (
            <CardContent>
              <Button asChild className="w-full">
                <a href="/login">Go to sign in</a>
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
