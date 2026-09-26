import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveWarehouseRecipient } from "@/app/(app)/warehouse/actions";

export function WarehouseNotifyCard({ emails }: { emails: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Warehouse check-in emails</CardTitle>
        <CardDescription>
          Set by admin, not on the warehouse floor. When a job is fully checked in, every address here gets the ready-to-schedule email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={saveWarehouseRecipient} className="space-y-3">
          <label className="text-xs">
            Recipients
            <textarea
              name="notifyEmail"
              defaultValue={emails}
              rows={4}
              placeholder={"scheduler@company.com\npm@company.com"}
              className="mt-1 block w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <p className="text-xs text-muted-foreground">One per line, or separated by commas.</p>
          <button className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm" type="submit">
            Save emails
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
