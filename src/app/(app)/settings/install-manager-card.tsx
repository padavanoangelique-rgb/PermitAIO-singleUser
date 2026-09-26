import { addInstallMember } from "@/app/(app)/install/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RemoveInstallMemberButton } from "./remove-install-member-button";

type Roster = {
  id: string;
  email: string;
  role: string;
  display_name?: string | null;
};

export function InstallManagerCard({
  managers,
  people,
}: {
  managers: Roster[];
  people: { email: string; name: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Install manager</CardTitle>
        <CardDescription>
          Assigned here. Then they go to permitaio.com/join, enter the company code, and create their own password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {managers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No install manager yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {managers.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>{m.display_name?.trim() || m.email}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Install manager</Badge>
                  <RemoveInstallMemberButton id={m.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <form action={addInstallMember} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="role" value="install_manager" />
          <input type="hidden" name="next" value="/settings" />
          <label className="text-xs">
            Name
            <input name="displayName" className="mt-1 block rounded border border-input bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs">
            Email
            <input
              name="email"
              type="email"
              list="install-manager-emails"
              className="mt-1 block h-11 w-full rounded-full border border-border bg-background px-3 text-sm text-foreground"
              required
            />
          </label>
          <datalist id="install-manager-emails">
            {people.map((p) => (
              <option key={p.email} value={p.email}>
                {p.name}
              </option>
            ))}
          </datalist>
          <button className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm" type="submit">
            Assign install manager
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
