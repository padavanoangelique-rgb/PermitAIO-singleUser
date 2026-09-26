"use client";

import { useState } from "react";
import { uploadNocByToken } from "@/lib/actions/contractor-mail";
import { FILL_BLUE } from "@/lib/ui/fills";

export function NocUploadForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <p className="mt-6 rounded-2xl bg-emerald-600/10 px-4 py-3 text-sm">NOC received. You can close this page.</p>;
  }

  return (
    <form
      className="mt-6 space-y-3"
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await uploadNocByToken(token, formData);
        setPending(false);
        if (result.error) setError(result.error);
        else setDone(true);
      }}
    >
      <input type="file" name="file" required className="block w-full text-sm" />
      <button type="submit" disabled={pending} className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ${FILL_BLUE}`}>
        {pending ? "Uploading…" : "Upload NOC"}
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
