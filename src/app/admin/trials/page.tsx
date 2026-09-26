import { getAdminOrgs } from "@/lib/data/platform-admin";
import { TrialsTable } from "./trials-table";

export default async function TrialsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { orgs, configError } = await getAdminOrgs();
  const { org: highlightSlug } = await searchParams;

  if (configError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {configError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Trials &amp; Billing</h1>
        <p className="text-sm text-muted-foreground">
          Extend trials, comp orgs, cancel subscriptions, and invite users into any org.
        </p>
      </div>
      <TrialsTable orgs={orgs} highlightSlug={highlightSlug} />
    </div>
  );
}
