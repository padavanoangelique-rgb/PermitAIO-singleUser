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
import { setOrgRoleSeats } from "./actions";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  permit_tech_seats: number;
  hoa_tech_seats: number;
  admin_seats: number;
  manager_seats: number;
  member_seats: number;
};

export default async function AdminRolesPage() {
  await requirePlatformAdmin();

  let orgs: OrgRow[] = [];
  let configError = "";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, name, slug, permit_tech_seats, hoa_tech_seats, admin_seats, manager_seats, member_seats")
      .order("name");
    if (error) configError = error.message;
    orgs = (data ?? []) as unknown as OrgRow[];
  } catch (err) {
    configError = err instanceof Error ? err.message : "Admin client is not configured.";
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Company Role Seats
        </h1>
        <p className="text-sm text-muted-foreground">
          How many of each position this company is onboarded for. Set this once per company — same place you&rsquo;d update it later if they add seats.
        </p>
      </div>

      {configError ? <p className="text-sm text-amber-700">{configError}</p> : null}

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Companies</CardTitle>
          <CardDescription>Save writes seat counts after supabase/31_org_role_seats.sql is applied.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            orgs.map((org) => (
              <form
                key={org.id}
                action={setOrgRoleSeats}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
              >
                <input type="hidden" name="orgId" value={org.id} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{org.name}</p>
                    <Badge variant="outline">/{org.slug}</Badge>
                  </div>
                </div>
                <label className="text-xs">
                  Permit techs
                  <input className="mt-1 w-16 rounded border px-2 py-1" type="number" min={0} name="permitTechs" defaultValue={org.permit_tech_seats} />
                </label>
                <label className="text-xs">
                  HOA techs
                  <input className="mt-1 w-16 rounded border px-2 py-1" type="number" min={0} name="hoaTechs" defaultValue={org.hoa_tech_seats} />
                </label>
                <label className="text-xs">
                  Admins
                  <input className="mt-1 w-16 rounded border px-2 py-1" type="number" min={0} name="admins" defaultValue={org.admin_seats} />
                </label>
                <label className="text-xs">
                  Managers
                  <input className="mt-1 w-16 rounded border px-2 py-1" type="number" min={0} name="managers" defaultValue={org.manager_seats} />
                </label>
                <label className="text-xs">
                  Members
                  <input className="mt-1 w-16 rounded border px-2 py-1" type="number" min={0} name="members" defaultValue={org.member_seats} />
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
