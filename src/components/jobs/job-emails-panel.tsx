"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowDownLeft, ArrowUpRight, Loader2, Mail, Paperclip, RefreshCw, Send } from "lucide-react";
import { EMAIL_TEMPLATES, applyTemplate, type EmailTemplateId } from "@/lib/job-emails/templates";

type Job = Tables<"jobs">;
type JobFile = Tables<"job_files">;

type JobEmail = {
  id: string;
  direction: "outbound" | "inbound";
  from_addr: string;
  to_addrs: string;
  subject: string;
  summary: string;
  attachment_names: string[];
  created_at: string;
};

const FIELD =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * "Emails" tab: send from the job (engineering request, HOA, supplier…), and see the replies
 * that come back. Replies are filed by the inbound webhook; attachments land in Documents.
 * Only a short summary of each message is kept.
 */
export function JobEmailsPanel({ job, orgName }: { job: Job; orgName: string }) {
  const [emails, setEmails] = useState<JobEmail[]>([]);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<EmailTemplateId>("engineering");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [copyMe, setCopyMe] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const address = [job.address, job.city].filter(Boolean).join(", ");

  const applyTpl = useCallback(
    (id: EmailTemplateId) => {
      const t = applyTemplate(id, {
        jobNumber: String(job.job_number ?? ""),
        clientName: String(job.client_name ?? ""),
        address,
        orgName,
      });
      setSubject(t.subject);
      setText(t.body);
    },
    [job.job_number, job.client_name, address, orgName],
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    const [mail, docs] = await Promise.all([
      (supabase as unknown as { from: (t: string) => any })
        .from("job_emails")
        .select("id, direction, from_addr, to_addrs, subject, summary, attachment_names, created_at")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_files")
        .select("*")
        .eq("org_id", job.org_id)
        .eq("job_id", job.id)
        .order("uploaded_at", { ascending: false }),
    ]);
    setEmails((mail.data ?? []) as JobEmail[]);
    setFiles(docs.data ?? []);
    setLoading(false);
  }, [job.id, job.org_id]);

  useEffect(() => {
    applyTpl("engineering");
  }, [applyTpl]);

  useEffect(() => {
    void load();
    // Replies arrive by webhook, so check again every 30 seconds while the tab is open.
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  function togglePicked(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const added: string[] = [];
    for (const file of Array.from(fileList)) {
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${job.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
      if (uploadError) {
        setError(`Couldn't upload ${file.name}: ${uploadError.message}`);
        continue;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { data: row, error: insertError } = await supabase
        .from("job_files")
        .insert({
          org_id: job.org_id,
          job_id: job.id,
          file_name: file.name,
          storage_path: path,
          size_bytes: file.size,
          uploaded_by: auth.user?.id ?? null,
          category: "supporting-doc",
        })
        .select("id")
        .maybeSingle();
      if (insertError || !row) {
        await supabase.storage.from("job-files").remove([path]);
        setError(`Couldn't save ${file.name}: ${insertError?.message ?? "unknown error"}`);
        continue;
      }
      added.push(row.id);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    await load();
    if (added.length) setPicked((cur) => [...cur, ...added]);
  }

  async function handleSend() {
    setError(null);
    setNotice(null);
    setSending(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/emails`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to, cc, subject, text, fileIds: picked, copyMe }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not send the email.");
        return;
      }
      setNotice("Sent. Replies will show up here and any files will be saved to Documents.");
      setPicked([]);
      applyTpl(template);
      await load();
    } finally {
      setSending(false);
    }
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Send an email from this job</CardTitle>
          <p className="text-sm text-muted-foreground">
            Replies to this email are filed on job {job.job_number} automatically, and any files the reply includes
            are saved to Documents. Only a short summary of each message is kept.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Template</span>
              <select
                className={FIELD}
                value={template}
                onChange={(e) => {
                  const id = e.target.value as EmailTemplateId;
                  setTemplate(id);
                  applyTpl(id);
                }}
              >
                {EMAIL_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To</span>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="engineer@example.com, another@example.com" />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cc (optional)</span>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</span>
            <textarea className={`${FIELD} min-h-[14rem]`} value={text} onChange={(e) => setText(e.target.value)} />
          </label>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Attach from this job&apos;s Documents
              </p>
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleUpload(e.target.files)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  <Paperclip className="h-3.5 w-3.5" />
                  {uploading ? "Uploading…" : "Upload a file"}
                </Button>
              </div>
            </div>
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents on this job yet.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {files.map((f) => (
                  <li key={f.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={picked.includes(f.id)} onChange={() => togglePicked(f.id)} />
                      <span className="truncate">{f.file_name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={copyMe} onChange={(e) => setCopyMe(e.target.checked)} />
              Send me a copy
            </label>
            <Button onClick={() => void handleSend()} disabled={sending || !to.trim() || !subject.trim() || !text.trim()}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? "Sending…" : "Send email"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-emerald-600">{notice}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="font-heading text-base">Email history</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {emails.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Mail className="h-6 w-6" />
              <p className="text-sm">No emails on this job yet.</p>
            </div>
          ) : (
            emails.map((m) => (
              <div key={m.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant={m.direction === "inbound" ? "default" : "secondary"} className="gap-1 text-xs">
                      {m.direction === "inbound" ? (
                        <ArrowDownLeft className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {m.direction === "inbound" ? "Reply" : "Sent"}
                    </Badge>
                    <p className="truncate text-sm font-medium">{m.subject}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmt(m.created_at)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.direction === "inbound" ? `From ${m.from_addr}` : `To ${m.to_addrs}`}
                </p>
                {m.summary && <p className="mt-2 text-sm">{m.summary}</p>}
                {m.attachment_names.length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    {m.attachment_names.join(", ")}
                    {m.direction === "inbound" ? " — saved to Documents" : ""}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
