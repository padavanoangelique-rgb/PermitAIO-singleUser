import { NocUploadForm } from "./noc-upload-form";

export default async function NocUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Upload Notice of Commencement</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Drop the recorded NOC here. It is filed on the contractor profile automatically.
      </p>
      <NocUploadForm token={token} />
    </main>
  );
}
