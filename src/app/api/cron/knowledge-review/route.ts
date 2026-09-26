import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { libraryEntryProblems, todayIsoET } from "@/lib/chat/answer-rules";
import { runKnowledgeChecks } from "@/lib/chat/knowledge-checks";

function from(admin: ReturnType<typeof createAdminClient>, name: string) {
  return (admin as unknown as { from: (t: string) => any }).from(name);
}

function norm(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Weekly gate. Known questions run first. If they fail, nothing is proposed
 * and nothing already published is touched. A bad published correction is
 * held so desks stop quoting it, and a person decides add or skip.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const failures = runKnowledgeChecks();
  if (failures.length) {
    return NextResponse.json(
      { ok: false, blocked: true, failures },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: orgs, error } = await admin.from("organizations").select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary: Record<string, unknown>[] = [];
  for (const org of orgs ?? []) {
    const orgId = org.id as string;
    let held = 0;
    let proposed = 0;

    const published = await from(admin, "corrections_library")
      .select("id, jurisdiction, correction, resolution, job_number, scope, approval_ground_truth, cross_ref, original_submission")
      .eq("org_id", orgId)
      .eq("status", "published")
      .limit(200);
    for (const row of published.data ?? []) {
      const problems = libraryEntryProblems(row);
      if (!problems.length) continue;
      await from(admin, "corrections_library")
        .update({ status: "held", updated_at: new Date().toISOString() })
        .eq("org_id", orgId)
        .eq("id", row.id);
      await from(admin, "proposed_updates").insert({
        org_id: orgId,
        library: "corrections",
        entry_id: row.id,
        kind: "weekly_self_update",
        proposed: { ...row, action: "republish" },
        previous: row,
        why: `Knowledge check held this entry before a desk can quote it. ${problems.join(" ")}`,
        author_label: "PermitAIO weekly check",
        status: "pending",
      });
      held += 1;
    }

    const lessons = await from(admin, "permit_correction_lessons")
      .select("jurisdiction, asked, cleared, job_number, created_at")
      .eq("org_id", orgId)
      .gte("created_at", since)
      .limit(200);
    const groups = new Map<string, { jurisdiction: string; asked: string; cleared: string | null; jobs: Set<string> }>();
    for (const lesson of lessons.data ?? []) {
      const asked = String(lesson.asked ?? "").trim();
      const jurisdiction = String(lesson.jurisdiction ?? "").trim();
      if (!asked || !jurisdiction) continue;
      const key = `${norm(jurisdiction)}|${norm(asked)}`;
      const group = groups.get(key) ?? { jurisdiction, asked, cleared: lesson.cleared ?? null, jobs: new Set<string>() };
      if (lesson.job_number) group.jobs.add(String(lesson.job_number));
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (group.jobs.size < 2) continue;
      const problems = libraryEntryProblems({
        jurisdiction: group.jurisdiction,
        correction: group.asked,
        resolution: group.cleared,
        scope: "jurisdiction",
      });
      if (problems.length) continue;
      const existing = await from(admin, "corrections_library")
        .select("id")
        .eq("org_id", orgId)
        .eq("status", "published")
        .eq("scope", "jurisdiction")
        .ilike("correction", group.asked.replace(/[%_]/g, String.fromCharCode(92) + "\$&"))
        .limit(1);
      if (existing.data?.length) continue;
      const pending = await from(admin, "proposed_updates")
        .select("proposed")
        .eq("org_id", orgId)
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .eq("kind", "library_correction")
        .limit(200);
      const already = (pending.data ?? []).some(
        (row: { proposed?: { correction?: string } }) => norm(String(row.proposed?.correction ?? "")) === norm(group.asked),
      );
      if (already) continue;
      await from(admin, "proposed_updates").insert({
        org_id: orgId,
        library: "corrections",
        kind: "library_correction",
        proposed: {
          action: "create",
          scope: "jurisdiction",
          jurisdiction: group.jurisdiction,
          correction: group.asked,
          resolution: group.cleared,
          job_number: [...group.jobs][0] ?? null,
          cross_ref: `Seen on jobs: ${[...group.jobs].join(", ")}`,
        },
        why: `The same correction is on ${group.jobs.size} jobs in ${group.jurisdiction} in the last 7 days. This is a lesson proposal, not a new fact.`,
        author_label: "PermitAIO weekly check",
        status: "pending",
      });
      proposed += 1;
    }
    summary.push({ org_id: orgId, held, proposed, day: todayIsoET() });
  }

  return NextResponse.json({ ok: true, checks: "passed", orgs: summary });
}
