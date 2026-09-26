"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createJob } from "@/lib/actions/jobs";
import { NEW_JOB_TRADE_OPTIONS } from "@/lib/jobs/trade";

export function NewJobDialog() {
  const [open, setOpen] = useState(false);
  const [tradeType, setTradeType] = useState("windows");
  const [state, formAction, pending] = useActionState(createJob, {
    error: null,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New job
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle className="font-heading">Create a job</DialogTitle>
            <DialogDescription>
              A job connects floor plans, permit inventory, and HOA tracking
              under one job number.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_number">Job number</Label>
                <Input id="job_number" name="job_number" placeholder="J-1042" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade_type">Trade</Label>
                <Select value={tradeType} onValueChange={setTradeType}>
                  <SelectTrigger id="trade_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NEW_JOB_TRADE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="trade_type" value={tradeType} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_name">Client name</Label>
              <Input id="client_name" name="client_name" placeholder="Jane Homeowner" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Property address</Label>
              <Input id="address" name="address" placeholder="123 Main St, Miami, FL" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folio_number">Folio number</Label>
              <Input id="folio_number" name="folio_number" placeholder="5041-01-234-5670" />
            </div>
          </div>
          {state.error && (
            <p className="mb-2 text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
