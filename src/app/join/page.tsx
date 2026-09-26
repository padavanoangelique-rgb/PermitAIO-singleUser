import { EasySignIn } from "@/components/marketing/easy-sign-in";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; code?: string }>;
}) {
  const { company, code } = await searchParams;
  return <EasySignIn company={company ?? ""} code={code ?? ""} />;
}
