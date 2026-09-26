"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitLead } from "@/lib/actions/leads";
import { cn } from "@/lib/utils";

const PLAN_OPTIONS = [
  { value: "essential", label: "Essential — $379/month" },
  { value: "priority", label: "Priority — $629/month" },
  { value: "concierge", label: "Concierge — $879/month" },
  { value: "unsure", label: "Not sure yet" },
] as const;

type Status =
  | { state: "idle" }
  | { state: "success" }
  | { state: "error"; message: string };

export function ContactForm({
  defaultPlan = "unsure",
}: {
  defaultPlan?: (typeof PLAN_OPTIONS)[number]["value"];
}) {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [plan, setPlan] =
    useState<(typeof PLAN_OPTIONS)[number]["value"]>(defaultPlan);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setStatus({ state: "idle" });
    const result = await submitLead({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      company: String(formData.get("company") ?? ""),
      plan_of_interest: plan,
      message: String(formData.get("message") ?? ""),
      website: String(formData.get("website") ?? ""),
    });

    if (result.ok) {
      setStatus({ state: "success" });
    } else {
      setStatus({ state: "error", message: result.error });
    }
  }

  if (status.state === "success") {
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-8 text-center">
        <p className="font-heading text-xl font-semibold">Thanks — we&apos;ll be in touch.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Angelique reads every lead personally and will email you back to schedule a call
          and send the payment link once the plan is set.
        </p>
        <p className="mt-4 text-sm">
          Need us sooner? Email{" "}
          <a
            className="text-primary underline"
            href="mailto:Hello@Permitaio.com"
          >
            Hello@Permitaio.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          void handleSubmit(formData);
        });
      }}
      className="space-y-4"
      noValidate
    >
      {/* Honeypot — hidden from humans and screen readers. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            name="company"
            autoComplete="organization"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="plan">Plan you&apos;re interested in</Label>
        <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
          <SelectTrigger id="plan">
            <SelectValue placeholder="Pick a plan" />
          </SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Anything we should know? (optional)</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder="How many users, roughly how many jobs / HOAs, what CRM you use, timing..."
        />
      </div>

      {status.state === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {status.message}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          No card required. Angelique replies personally and sends a payment link
          after the call.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className={cn(isPending && "opacity-70")}
        >
          {isPending ? "Sending..." : "Request info"}
        </Button>
      </div>
    </form>
  );
}
