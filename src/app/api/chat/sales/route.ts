import { NextResponse } from "next/server";
import { SALES_PROMPT } from "@/lib/chat/sales-prompt";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { messages?: Msg[] } | null;
  const history = (body?.messages ?? []).filter((m) => m.content?.trim()).slice(-10);
  if (!history.length) return NextResponse.json({ error: "empty" }, { status: 400 });

  const key = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({
      reply: "Chat is on, but the site key is not set. Use Start free trial.",
    });
  }

  const useXai = Boolean(process.env.XAI_API_KEY);
  const res = await fetch(
    useXai ? "https://api.x.ai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: useXai ? "grok-4-fast" : "gpt-4o-mini",
        temperature: 0.3,
        messages: [{ role: "system", content: SALES_PROMPT }, ...history],
      }),
    },
  );
  if (!res.ok) return NextResponse.json({ error: "model" }, { status: 502 });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return NextResponse.json({
    reply: data.choices?.[0]?.message?.content?.trim() || "Ask about the product or the free trial.",
  });
}
