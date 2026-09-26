"use server";

import { randomBytes } from "crypto";
import { requireActiveOrg } from "@/lib/data/orgs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_NOC_BODY,
  DEFAULT_NOC_SUBJECT,
  DEFAULT_REGISTRATION_BODY,
  DEFAULT_REGISTRATION_SUBJECT,
  DEFAULT_UPDATE_BODY,
  DEFAULT_UPDATE_SUBJECT,
  fillContractorTemplate,
} from "@/lib/contractors/kinds";
import { revalidatePath } from "next/cache";

type MailKind = "update" | "registration" | "noc";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

async function signedFile(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("contractor-docs").download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function sendContractorEmail(input: {
  contractorId: string;
  kind: MailKind;
  to: string;
  subject: string;
  body: string;
  fileIds: string[];
  jurisdiction?: string;
  origin: string;
  includePlatformDocs?: boolean;
}): Promise<{ error: string | null; sentTo?: string }> {
  const { activeOrg } = await requireActiveOrg();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "Email is not configured yet." };

  const to = input.to.trim();
  if (!to.includes("@")) return { error: "Enter an email to send to." };

  const supabase = await createClient();
  const { data: contractor, error: cErr } = await supabase
    .from("contractor_profiles")
    .select("*")
    .eq("id", input.contractorId)
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  if (cErr || !contractor) return { error: cErr?.message ?? "Contractor not found." };

  let nocLink = "";
  if (input.kind === "noc") {
    const token = randomBytes(18).toString("hex");
    const { error: tErr } = await supabase.from("contractor_noc_tokens" as never).insert({
      org_id: activeOrg.id,
      contractor_id: contractor.id,
      token,
    } as never);
    if (tErr) return { error: tErr.message };
    nocLink = `${input.origin.replace(/\/$/, "")}/noc/${token}`;
  }

  const packet = input.jurisdiction
    ? (
        await supabase
          .from("platform_registration_packets" as never)
          .select("*")
          .eq("jurisdiction", input.jurisdiction)
          .maybeSingle()
      ).data as {
        id: string;
        instructions: string | null;
        registration_subject: string | null;
        registration_body: string | null;
        noc_subject: string | null;
        noc_body: string | null;
        building_dept_email: string | null;
      } | null
    : null;

  const vars = {
    company: contractor.company_name,
    license: contractor.license_number,
    qualifier: contractor.qualifier_name,
    contact: contractor.contact_name,
    phone: contractor.phone,
    email: contractor.email,
    jurisdiction: input.jurisdiction ?? "",
    instructions: packet?.instructions ?? "",
    noc_link: nocLink,
  };

  const fallbackSubject =
    input.kind === "registration"
      ? packet?.registration_subject || DEFAULT_REGISTRATION_SUBJECT
      : input.kind === "noc"
        ? packet?.noc_subject || DEFAULT_NOC_SUBJECT
        : DEFAULT_UPDATE_SUBJECT;
  const fallbackBody =
    input.kind === "registration"
      ? packet?.registration_body || DEFAULT_REGISTRATION_BODY
      : input.kind === "noc"
        ? packet?.noc_body || DEFAULT_NOC_BODY
        : DEFAULT_UPDATE_BODY;

  const subject = fillContractorTemplate(input.subject.trim() || fallbackSubject, vars);
  const body = fillContractorTemplate(input.body.trim() || fallbackBody, vars);

  const attachments: { filename: string; content: string }[] = [];

  if (input.fileIds.length) {
    const { data: files } = await supabase
      .from("contractor_files" as never)
      .select("id, file_name, storage_path")
      .eq("contractor_id", contractor.id)
      .in("id", input.fileIds);
    for (const file of (files as { id: string; file_name: string; storage_path: string }[] | null) ?? []) {
      const buf = await signedFile(file.storage_path);
      if (buf) attachments.push({ filename: file.file_name, content: buf.toString("base64") });
    }
  }

  if (input.includePlatformDocs && packet?.id) {
    const { data: docs } = await supabase
      .from("platform_registration_docs" as never)
      .select("title, file_name, file_data, kind")
      .eq("packet_id", packet.id);
    for (const doc of (docs as { title: string; file_name: string | null; file_data: string | null; kind: string }[] | null) ?? []) {
      if (!doc.file_data) continue;
      if (input.kind === "registration" && doc.kind === "noc") continue;
      if (input.kind === "noc" && doc.kind === "registration") continue;
      attachments.push({
        filename: doc.file_name || `${doc.title}.pdf`,
        content: doc.file_data,
      });
    }
  }

  const html = `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PermitAIO <notifications@permitaio.com>",
      to: [to],
      reply_to: "agent@permitaio.com",
      subject,
      html,
      attachments: attachments.length ? attachments : undefined,
    }),
  });
  if (!res.ok) return { error: `Email did not send (${res.status}).` };

  revalidatePath("/contractors");
  return { error: null, sentTo: to };
}

export async function uploadNocByToken(token: string, formData: FormData): Promise<{ error: string | null }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("contractor_noc_tokens" as never)
    .select("id, org_id, contractor_id")
    .eq("token", token)
    .maybeSingle();
  if (error || !row) return { error: "This upload link is not valid." };
  const rec = row as { id: string; org_id: string; contractor_id: string };
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${rec.contractor_id}/${Date.now()}-noc-${safe}`;
  const { error: upErr } = await admin.storage.from("contractor-docs").upload(path, file);
  if (upErr) return { error: upErr.message };
  const { error: insErr } = await admin.from("contractor_files" as never).insert({
    org_id: rec.org_id,
    contractor_id: rec.contractor_id,
    file_name: file.name,
    storage_path: path,
    size_bytes: file.size,
    label: "NOC",
    kind: "noc",
  } as never);
  if (insErr) return { error: insErr.message };
  await admin
    .from("contractor_noc_tokens" as never)
    .update({ used_at: new Date().toISOString() } as never)
    .eq("id", rec.id);
  return { error: null };
}
