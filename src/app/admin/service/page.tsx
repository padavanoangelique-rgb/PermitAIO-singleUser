import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { setServiceDashboard } from "./actions";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  service_dashboard_enabled?: boolean | null;
  service_seat_managers?: number | null;
  service_seat_techs?: number | null;
};

export default async function AdminServicePage() {
  await requirePlatformAdmin();

  let orgs: OrgRow[] = [];
  let configError = "";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, name, slug, service_dashboard_enabled, service_seat_managers, service_seat_techs" as never)
      .order("name");
    if (error) {
      const fallback = await admin.from("organizations").select("id, name, slug").order("name");
      if (fallback.error) configError = fallback.error.message;
      orgs = (fallback.data ?? []) as OrgRow[];
      if (error.message) configError = error.message;
    } else {
      orgs = (data ?? []) as unknown as OrgRow[];
    }
  } catch (err) {
    configError = err instanceof Error ? err.message : "Admin client is not configured.";
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Service Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Turn it on per company. Default seats: 2 service managers, 8 service techs. Company Settings assigns the people.
        </p>
      </div>

      {configError ? <p className="text-sm text-amber-700">{configError}</p> : null}

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Companies</CardTitle>
          <CardDescription>Save writes the flag after supabase/55_service_seats.sql is applied.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            orgs.map((org) => (
              <form
                key={org.id}
                action={setServiceDashboard}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end sm:justify-between"
              >
                <input type="hidden" name="orgId" value={org.id} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{org.name}</p>
                    <Badge variant="outline">/{org.slug}</Badge>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="enabled" defaultChecked={org.service_dashboard_enabled !== false} />
                  Include Service Dashboard
                </label>
                <label className="text-xs">
                  Managers
                  <input
                    className="mt-1 w-16 rounded border px-2 py-1"
                    type="number"
                    min={0}
                    name="managers"
                    defaultValue={org.service_seat_managers ?? 2}
                  />
                </label>
                <label className="text-xs">
                  Techs
                  <input
                    className="mt-1 w-16 rounded border px-2 py-1"
                    type="number"
                    min={0}
                    name="techs"
                    defaultValue={org.service_seat_techs ?? 8}
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm"
                >
                  Save
                </button>
              </form>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
