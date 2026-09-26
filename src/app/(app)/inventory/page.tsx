import { InventoryBoard } from "@/components/inventory/inventory-board";
import { requireActiveOrg, requireUser } from "@/lib/data/orgs";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const { report } = await searchParams;
  return (
    <InventoryBoard
      orgId={activeOrg.id}
      orgName={activeOrg.name}
      userId={user.id}
      initialReport={report}
    />
  );
}
