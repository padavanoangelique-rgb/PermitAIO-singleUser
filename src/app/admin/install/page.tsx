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
import { setInstallDashboard } from "./actions";

type OrgRow = { id: string; name: string; slug: string };

export default async function AdminInstallPage() {
  await requirePlatformAdmin();

  let orgs: OrgRow[] = [];
  let configError = "";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, name, slug")
      .order("name");
    if (error) configError = error.message;
    orgs = (data ?? []) as OrgRow[];
  } catch (err) {
    configError = err instanceof Error ? err.message : "Admin client is not configured.";
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Install Dashboard by PermitAIO
        </h1>
        <p className="text-sm text-muted-foreground">
          Optional add-on. Turn it on per company. Default seats: 4 install managers, 4 project managers, 8 installers.
          Company admin permit@guardwhatmatters.com can see permits and installs.
        </p>
      </div>

      {configError ? <p className="text-sm text-amber-700">{configError}</p> : null}

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Companies</CardTitle>
          <CardDescription>Save writes the feature flag after supabase/19_install_dashboard.sql is applied.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            orgs.map((org) => (
              <form
                key={org.id}
                action={setInstallDashboard}
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
                  <input type="checkbox" name="enabled" defaultChecked />
                  Include Install Dashboard
                </label>
                <label className="text-xs">
                  Managers
                  <input className="mt-1 w-16 rounded border px-2 py-1" type="number" min={0} name="managers" defaultValue={4} />
                </label>
                <label className="text-xs">
                  PMs
                  <input className="mt-1 w-16 rounded border px-2 py-1" type="number" min={0} name="pms" defaultValue={4} />
                </label>
                <label className="text-xs">
                  Installers
                  <input className="mt-1 w-16 rounded border px-2 py-1" type="number" min={0} name="installers" defaultValue={8} />
                </label>
                <button type="submit" className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm">
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
