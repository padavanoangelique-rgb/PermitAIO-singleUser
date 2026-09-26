import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { RoleGuideChart } from "@/components/marketing/role-guide-chart";
import { ROLE_GUIDES, roleGuideBySlug } from "@/lib/marketing/role-guides";

export function generateStaticParams() {
  return ROLE_GUIDES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const role = ROLE_GUIDES.find((r) => r.slug === slug);
  if (!role) return { title: "Role guide" };
  return {
    title: `${role.role} — how to use PermitAIO`,
    description: role.purpose,
  };
}

export default async function GuideSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!ROLE_GUIDES.some((r) => r.slug === slug)) notFound();
  const role = roleGuideBySlug(slug);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Role chart</p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            {role.role}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{role.purpose}</p>
          <div className="mt-10">
            <RoleGuideChart initialSlug={slug} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
