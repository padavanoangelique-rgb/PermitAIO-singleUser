"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContractorFile = {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  label: string | null;
  expires_on: string | null;
};

export function ContractorDocsPanel({
  contractorId,
  orgId,
}: {
  contractorId: string;
  orgId: string;
}) {
  const [files, setFiles] = useState<ContractorFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresOn, setExpiresOn] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contractor_files" as never)
      .select("id, file_name, storage_path, size_bytes, label, expires_on")
      .eq("contractor_id", contractorId)
      .order("uploaded_at", { ascending: false });
    if (error) return;
    setFiles((data as ContractorFile[] | null) ?? []);
  }, [contractorId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setUploading(true);
    const supabase = createClient();
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${contractorId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("contractor-docs").upload(path, file);
    if (upErr) {
      setUploading(false);
      alert(`Couldn't upload that file: ${upErr.message}`);
      return;
    }
    const { error: insErr } = await supabase.from("contractor_files" as never).insert({
      org_id: orgId,
      contractor_id: contractorId,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      label: label.trim() || null,
      expires_on: expiresOn || null,
    } as never);
    if (insErr) {
      await supabase.storage.from("contractor-docs").remove([path]);
      alert(`Couldn't save that file: ${insErr.message}`);
    }
    setLabel("");
    setExpiresOn("");
    setUploading(false);
    await load();
  }

  async function download(file: ContractorFile) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("contractor-docs").createSignedUrl(file.storage_path, 60);
    if (error || !data) {
      alert(`Couldn't open that file: ${error?.message ?? "unknown error"}`);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function remove(file: ContractorFile) {
    if (!confirm(`Remove ${file.file_name}?`)) return;
    const supabase = createClient();
    await supabase.from("contractor_files" as never).delete().eq("id", file.id);
    await supabase.storage.from("contractor-docs").remove([file.storage_path]);
    await load();
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
      <p className="text-xs text-muted-foreground">License, insurance, W-9, BTR — attach here with an expiration if it has one.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="General liability, license…" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Expires</Label>
          <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Label className="cursor-pointer">
          <Paperclip /> {uploading ? "Uploading…" : "Upload document"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void upload(picked);
              e.target.value = "";
            }}
          />
        </Label>
      </Button>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-sm">
              <Button type="button" variant="link" size="xs" className="min-w-0 flex-1 justify-start truncate px-0" onClick={() => void download(file)}>
                <Download /> {file.label || file.file_name}
              </Button>
              {file.expires_on && (
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">exp {file.expires_on}</span>
              )}
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => void remove(file)}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
