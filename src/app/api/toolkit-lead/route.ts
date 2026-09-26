import { NextResponse } from "next/server";

const ALLOW = [
  "https://permittoolkit.com",
  "https://www.permittoolkit.com",
];

function cors(origin: string | null) {
  const allow =
    origin && (ALLOW.includes(origin) || origin.endsWith(".permittoolkit.com"))
      ? origin
      : ALLOW[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const headers = cors(req.headers.get("origin"));
  let body: {
    email?: string;
    role?: string;
    source?: string;
    first_tool?: string;
    user_agent?: string;
    referrer?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers });
  }
  const email = (body.email || "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false }, { status: 400, headers });
  }

  const webhook = process.env.TOOLKIT_SHEET_WEBHOOK;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          email,
          role: body.role || "",
          source: body.source || "permit-toolkit",
          first_tool: body.first_tool || "",
          user_agent: body.user_agent || "",
          referrer: body.referrer || "",
        }),
      });
    } catch {
      /* sheet is best-effort */
    }
  }
  return NextResponse.json({ ok: true }, { headers });
}
