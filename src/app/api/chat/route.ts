import { NextResponse } from "next/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { createClient } from "@/lib/supabase/server";
import {
  asDesk,
  pickSpecialists,
  specialistLabel,
  isShopSalesHotLead,
  HOT_LEAD_ESCALATION,
} from "@/lib/chat/bots";
import { isHowToQuery } from "@/lib/chat/initial-reports";
import { deskPrompt, specialistPrompt } from "@/lib/chat/prompts";
import { retrievePermitAio } from "@/lib/chat/retrieve";
import { emptyAnswer, isHoaDurationAsk, isLiveStatusAsk, looksLikeBulletWall, weekFields } from "@/lib/chat/answer-rules";
import { scoutJobNow } from "@/lib/agents/permit-scout/run";
import { notify } from "@/lib/notifications/notify";
import { rememberFromChat, feedCorrectionLesson } from "@/lib/actions/correction-lessons";
import { runAssistantCommand } from "@/lib/chat/job-assistant";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string };

async function llm(system: string, messages: Msg[]) {
  const key = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return { text: null as string | null, missingKey: true };
  const useXai = Boolean(process.env.XAI_API_KEY);
  const url = useXai
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = useXai ? "grok-4-fast" : "gpt-4o-mini";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) return { text: null as string | null, missingKey: false };
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { text: data.choices?.[0]?.message?.content?.trim() || null, missingKey: false };
}

function lastUserText(history: Msg[]) {
  return [...history].reverse().find((m) => m.role === "user")?.content ?? "";
}

export async function POST(req: Request) {
  let orgId = "";
  let userId = "";
  let permitTechLabel: string | null = null;
  let hoaTechLabel: string | null = null;
  let role = "";
  try {
    const user = await requireUser();
    userId = user.id;
    const active = await requireActiveOrg();
    orgId = active.activeOrg.id;
    permitTechLabel = active.permitTechLabel;
    hoaTechLabel = active.hoaTechLabel;
    role = active.role;
  } catch {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  let deskName: string | undefined;
  let history: Msg[] = [];
  let letter: File | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    deskName = String(form.get("bot") ?? "");
    try {
      history = JSON.parse(String(form.get("messages") ?? "[]")) as Msg[];
    } catch {
      history = [];
    }
    const raw = form.get("letter");
    letter = raw instanceof File && raw.size > 0 ? raw : null;
  } else {
    const body = (await req.json().catch(() => null)) as { bot?: string; messages?: Msg[] } | null;
    deskName = body?.bot;
    history = body?.messages ?? [];
  }
  const desk = asDesk(deskName);
  history = history.filter((m) => m.content?.trim()).slice(-12);
  if (!history.length) return NextResponse.json({ error: "empty" }, { status: 400 });

  const orgManager = role === "owner" || role === "admin" || role === "manager";
  if ((desk === "permit" || desk === "corrections") && !orgManager && !permitTechLabel) {
    return NextResponse.json({ error: "This desk is for permit techs." }, { status: 403 });
  }
  if (desk === "hoa" && !orgManager && !hoaTechLabel) {
    return NextResponse.json({ error: "This desk is for HOA techs." }, { status: 403 });
  }

  const supabase = await createClient();
  const asked = lastUserText(history);

  if (desk !== "support") {
    try {
      const assistant = await runAssistantCommand(supabase, { orgId, userId, text: asked });
      if (assistant.handled) {
        return NextResponse.json({ reply: assistant.reply, consulted: [] });
      }
    } catch (err) {
      console.error("assistant command failed", err);
    }
  }

  let attachedNote = "";
  if (letter && (desk === "corrections" || desk === "permit")) {
    let letterText = "";
    if (letter.type.startsWith("text/") || /\.txt$/i.test(letter.name)) {
      try {
        letterText = (await letter.text()).slice(0, 4000).trim();
      } catch {
        letterText = "";
      }
    }
    const jobMatch = asked.match(/\b(?:job\s*#?\s*)?#?\s*([A-Za-z]{0,4}-?\d{3,})\b/i);
    const fd = new FormData();
    if (!letterText) fd.set("letter", letter);
    fd.set(
      "asked",
      asked.replace(/^Attached:.*$/m, "").trim() || letterText || `Correction letter on file: ${letter.name}`,
    );
    if (jobMatch?.[1]) fd.set("jobNumber", jobMatch[1]);
    const saved = await feedCorrectionLesson(fd);
    attachedNote = saved.error
      ? `Attachment ${letter.name}: ${saved.error}`
      : saved.message ?? `Saved letter ${letter.name}.`;
    if (letterText) attachedNote += `\nLETTER TEXT:\n${letterText}`;
  }

  if (
    desk === "corrections" &&
    /^(save this|save it|remember( this| that)?|teach (him|this)|log this)\b/i.test(asked.trim())
  ) {
    const users = history.filter((m) => m.role === "user");
    if (users.length < 2) {
      return NextResponse.json({
        reply: "Paste the city comment or upload the letter first. Then say Save this.",
        consulted: [],
      });
    }
    const prior = users[users.length - 2].content;
    const jobMatch = `${asked} ${prior}`.match(/\b(?:job\s*#?\s*)?#?\s*([A-Za-z]{0,4}-?\d{3,})\b/i);
    const cityMatch = `${asked} ${prior}`.match(/\b(?:city of |for |in )([A-Za-z][A-Za-z .'-]{2,30})/i);
    const remembered = await rememberFromChat({
      asked: prior.trim(),
      jobNumber: jobMatch?.[1] ?? null,
      jurisdiction: cityMatch?.[1]?.trim() ?? null,
    });
    return NextResponse.json({ reply: remembered.message, consulted: [] });
  }

  if ((desk === "main" || desk === "permit") && isLiveStatusAsk(asked)) {
    try {
      const scout = await scoutJobNow(orgId, asked);
      return NextResponse.json({ reply: scout.spoken, consulted: ["permit_scout"] });
    } catch (err) {
      console.error("permit scout failed", err);
      return NextResponse.json({
        reply: "I don't have a live reading. The building department has the record.",
        consulted: ["permit_scout"],
      });
    }
  }

  let facts = "";
  let spoken = "";
  let empty = true;
  let retrievalMeta = "";
  try {
    const found = await retrievePermitAio(supabase, orgId, asked, desk);
    facts = found.text;
    spoken = found.spoken;
    empty = found.empty;
    retrievalMeta = `${found.retrievalPath}: ${found.retrievalNote}`;
  } catch (err) {
    console.error("chat retrieve failed", err);
  }
  if (attachedNote) {
    facts = facts ? `${attachedNote}\n\n${facts}` : attachedNote;
    empty = false;
  }

  const topic = desk === "hoa" ? "hoa" : desk === "support" ? "general" : "permit";
  if (desk === "support") {
    try {
      await notify({
        orgId,
        jobId: null,
        permitTech: permitTechLabel,
        source: "team_request",
        message: `Tech support (needs owner approval): ${asked.slice(0, 500)}`,
        requestedBy: userId,
      });
    } catch (err) {
      console.error("support log failed", err);
    }
  }
  if ((desk === "main" || desk === "permit") && weekFields(asked)) {
    return NextResponse.json({ reply: spoken || emptyAnswer(topic), consulted: [] });
  }
  if (desk === "hoa" && isHoaDurationAsk(asked)) {
    return NextResponse.json({ reply: spoken || emptyAnswer("hoa"), consulted: [] });
  }
  // REMOVED: keyword-empty early return. Always run specialists + desk LLM on substantive questions.
  // The model may say "I don't have that" only when FACTS are truly empty / no relevant chunks.

  const specialists = pickSpecialists(asked, desk);
  if (
    desk === "corrections" &&
    (letter || isHowToQuery(asked)) &&
    !specialists.includes("investigator")
  ) {
    specialists.push("investigator");
  }
  const briefings: string[] = [];
  if (specialists.length) {
    const consults = await Promise.all(
      specialists.map(async (id) => {
        const briefing = await llm(
          `${specialistPrompt(id)}

FACTS (from the shared semantic retrieval — do not look elsewhere):
${facts || "(no matching records)"}`,
          [{ role: "user", content: asked }],
        );
        return briefing.text
          ? `SPECIALIST BRIEFING (${specialistLabel(id)}):\n${briefing.text}`
          : "";
      }),
    );
    briefings.push(...consults.filter(Boolean));
  }

  const hotLeadBlock = isShopSalesHotLead(asked) ? `\n\n${HOT_LEAD_ESCALATION}` : "";

  const system = `${deskPrompt(desk)}${hotLeadBlock}

FACTS (one shared semantic retrieval — jobs, notes, date fields, libraries, HOA, research, Permit Scout — only what exists):
${facts || "(no matching records)"}
${retrievalMeta ? `\n(Retrieval: ${retrievalMeta})` : ""}

${briefings.join("\n\n")}`.trim();

  const chat = await llm(system, history);
  const phoneDesk = desk === "main" || desk === "permit";
  const fallback = spoken || (facts && !empty ? facts : emptyAnswer(topic));
  const shaped =
    phoneDesk && spoken && chat.text && looksLikeBulletWall(chat.text) ? spoken : chat.text || fallback;
  if (chat.missingKey) {
    const keyMsg =
      "The site model key is not set (XAI_API_KEY or OPENAI_API_KEY). Ask cannot draft an LLM answer until a key is configured.";
    return NextResponse.json({
      reply: spoken
        ? `${spoken}\n\n(${keyMsg} I can only repeat spoken facts from the job file.)`
        : keyMsg,
      consulted: specialists,
    });
  }
  return NextResponse.json({
    reply: shaped,
    consulted: specialists,
  });
}
