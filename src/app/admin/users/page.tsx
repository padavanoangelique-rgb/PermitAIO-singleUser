import { requireUser } from "@/lib/data/orgs";
import { getAdminUsers } from "@/lib/data/platform-users";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsersTable } from "./users-table";
import { AlertTriangle } from "lucide-react";

export default async function AdminUsersPage() {
  const user = await requireUser();
  const { users, configError } = await getAdminUsers();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Users
        </h1>
        <p className="text-sm text-muted-foreground">
          Everyone with a PermitAIO account. Grant or revoke platform-admin
          access here — that role bypasses per-org isolation and can edit the
          shared NOA catalog.
        </p>
      </div>

      {configError ? (
        <Card className="border-amber-300 bg-amber-50 py-0 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Users tab needs the service-role key
              </p>
              <p className="mt-1 text-amber-800 dark:text-amber-300">
                Add <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900">SUPABASE_SERVICE_ROLE_KEY</code> to this environment&apos;s variables to read cross-org user data.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">All users</CardTitle>
          <CardDescription>
            Sorted newest first. Toggle the badge to add or remove platform-admin
            access.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <UsersTable users={users} currentUserId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
