import { redirect } from "next/navigation";
import { requireActiveOrg, canAccessAccounting } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { getTechNames } from "@/lib/data/tech-names";
import { AccountingBoard } from "./accounting-board";

export default async function AccountingPage() {
  const { activeOrg, role } = await requireActiveOrg();
  const admin = await isPlatformAdmin();
  if (!canAccessAccounting(role) && !admin) {
    redirect("/dashboard");
  }
  const techNames = await getTechNames(activeOrg.id, "permit");
  return <AccountingBoard orgId={activeOrg.id} orgName={activeOrg.name} techNames={techNames} />;
}