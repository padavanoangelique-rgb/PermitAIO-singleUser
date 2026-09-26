"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BTN_BLUE } from "@/lib/ui/chrome";

export function InvoiceDownloadButton({ storagePath, fileName }: { storagePath: string; fileName: string }) {
  const [error, setError] = useState("");

  async function download() {
    setError("");
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage.from("job-files").createSignedUrl(storagePath, 60);
    if (signError || !data) {
      setError(signError?.message ?? "Couldn't open that file.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void download()}
        className={`${BTN_BLUE} print:hidden`}
      >
        Download
      </button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      <span className="sr-only">{fileName}</span>
    </div>
  );
}
