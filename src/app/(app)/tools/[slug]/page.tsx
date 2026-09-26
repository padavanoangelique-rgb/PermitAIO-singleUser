import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/data/orgs";
import { fieldToolBySlug } from "@/lib/field-tools";
import { ToolFrame } from "../tool-frame";
import { PatioChecklist } from "../patio-checklist";
import { FenceBuilder } from "../fence-builder";

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { activeOrg } = await requireActiveOrg();
  const { slug } = await params;
  const tool = fieldToolBySlug(slug);
  if (!tool) notFound();

  if (slug === "patio-enclosure-permit-guide") {
    return <PatioChecklist orgId={activeOrg.id} />;
  }

  if (slug === "fence-permit-builder") {
    return <FenceBuilder orgId={activeOrg.id} />;
  }

  return <ToolFrame title={tool.title} src={`/tools/${tool.file}?embed=1`} />;
}
