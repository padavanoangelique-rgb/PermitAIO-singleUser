import { HoaTrackerBoard } from "@/components/hoa/hoa-tracker-board";
import { requireActiveOrg, requireUser } from "@/lib/data/orgs";

export default async function HoaPage() {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  return <HoaTrackerBoard orgId={activeOrg.id} orgName={activeOrg.name} />;
}
