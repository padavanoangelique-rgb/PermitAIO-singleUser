import {
  SEARCH_SOURCES,
  emptyAnswer,
  formatTimeframeLine,
  hoaTurnaround,
  inWindow,
  isFactWrite,
  isInterpretation,
  libraryEntryProblems,
  looksLikeBulletWall,
  parsePortalStatus,
  scoutToken,
  shouldNotifyScout,
  spokenJob,
  spokenWeek,
  weekFields,
  weekWindow,
} from "./answer-rules";

export type CheckFailure = { id: string; detail: string };

const GOOD_ENTRY = {
  jurisdiction: "Wellington",
  correction: "City asked for the product approval number on the opening schedule.",
  resolution: "Put the NOA number that was already on the job file onto the schedule.",
  job_number: "100137",
  scope: "job" as const,
  approval_ground_truth: "Approval letter condition: install per the NOA listed on the permit. Not just the stamp.",
};

const BAD_ENTRY = {
  jurisdiction: "Miramar",
  correction: "I think they usually take 10 days.",
  resolution: "Probably fine.",
  job_number: "",
  scope: "jurisdiction" as const,
  approval_ground_truth: "stamp",
};

function fail(id: string, detail: string): CheckFailure {
  return { id, detail };
}

/** Known questions with known answers. A weekly update must pass these before anyone sees a library change. */
export function runKnowledgeChecks(nowIso = "2026-09-24"): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const window = weekWindow(nowIso);
  if (window.start !== "2026-09-17" || window.end !== "2026-09-24") {
    failures.push(fail("week-window", `Expected 2026-09-17 through 2026-09-24, got ${window.start} through ${window.end}.`));
  }
  if (!inWindow("2026-09-17", window) || inWindow("2026-09-16", window)) {
    failures.push(fail("week-window-edges", "The 7-day window included the wrong dates."));
  }
  if (inWindow("approved last Tuesday", window)) {
    failures.push(fail("week-ignores-prose", "A free-text note was treated as a date."));
  }

  const fields = weekFields("what permits got approved this week");
  if (!fields || fields.join() !== "approved_date") {
    failures.push(fail("week-field", "Approved-this-week did not use the approved date field."));
  }

  const weekAnswer = spokenWeek("approved_date", [
    { job_number: "1001", client_name: "Smith", date: "2026-09-20" },
  ]);
  if (!weekAnswer.includes("1001") || !weekAnswer.includes("2026-09-20") || looksLikeBulletWall(weekAnswer)) {
    failures.push(fail("week-spoken", weekAnswer));
  }
  const weekEmpty = spokenWeek("approved_date", []);
  if (!weekEmpty.startsWith("I don't have")) {
    failures.push(fail("week-empty", weekEmpty));
  }

  const phone = spokenJob({
    job_number: "100137",
    client_name: "Rivera",
    sub_status: "In Review",
    jurisdiction: "Wellington",
    permit_number: "PR-100",
    submitted_date: "2026-09-12",
  });
  if (!phone.startsWith("Job 100137") || phone.includes("|") || looksLikeBulletWall(phone) || !phone.includes("PR-100")) {
    failures.push(fail("phone-job", phone));
  }

  const one = hoaTurnaround([{ days: 21, approvedOn: "2026-08-01" }], nowIso);
  if (one.n !== 1 || !/one data point/i.test(one.text)) {
    failures.push(fail("hoa-one-point", one.text));
  }
  const none = hoaTurnaround([], nowIso);
  if (!none.text.startsWith("I don't have")) {
    failures.push(fail("hoa-none", none.text));
  }
  const many = hoaTurnaround(
    [
      { days: 10, approvedOn: "2026-09-01" },
      { days: 40, approvedOn: "2025-01-01" },
    ],
    nowIso,
  );
  if (many.n !== 2 || !/recent-weighted/i.test(many.text)) {
    failures.push(fail("hoa-weighted", many.text));
  }

  const approved = parsePortalStatus("<div>Application PR-9 status: Approved for issue</div>", "PR-9");
  if (approved.status !== "approved") failures.push(fail("scout-approved", approved.status));
  const corrections = parsePortalStatus("<p>PR-9 Corrections required. Revise and resubmit.</p>", "PR-9");
  if (corrections.status !== "corrections") failures.push(fail("scout-corrections", corrections.status));
  const payment = parsePortalStatus("<p>PR-9 balance due before issuance</p>", "PR-9");
  if (payment.status !== "payment") failures.push(fail("scout-payment", payment.status));
  const missing = parsePortalStatus("<p>No records</p>", "PR-9");
  if (missing.status !== "not_on_page") failures.push(fail("scout-missing", missing.status));
  const notApproved = parsePortalStatus("<p>PR-9 is not approved</p>", "PR-9");
  if (notApproved.status === "approved") failures.push(fail("scout-not-approved", notApproved.status));
  if (!shouldNotifyScout("approved") || shouldNotifyScout("not_on_page") || shouldNotifyScout("mentioned")) {
    failures.push(fail("scout-notify", "Notification rule did not match approved / payment / corrections only."));
  }
  if (scoutToken("approved") !== "[permit-scout:approved]") {
    failures.push(fail("scout-token", scoutToken("approved")));
  }

  const blank = emptyAnswer("permit");
  if (!blank.startsWith("I don't have that") || !/building department/i.test(blank)) {
    failures.push(fail("empty-permit", blank));
  }
  const hoaBlank = emptyAnswer("hoa");
  if (!hoaBlank.startsWith("I don't have that") || !/\bHOA\b/.test(hoaBlank)) {
    failures.push(fail("empty-hoa", hoaBlank));
  }

  if (libraryEntryProblems(GOOD_ENTRY).length) {
    failures.push(fail("library-good", libraryEntryProblems(GOOD_ENTRY).join(" ")));
  }
  const bad = libraryEntryProblems(BAD_ENTRY);
  if (bad.length < 2) failures.push(fail("library-bad", bad.join(" ") || "bad entry was accepted"));

  const line = formatTimeframeLine("Palm Beach County Unincorporated", null, 0);
  if (!/will not estimate/i.test(line) || !/Cycle Time report/i.test(line)) {
    failures.push(fail("timeframe-empty", line));
  }
  const line2 = formatTimeframeLine("Miramar", 12.4, 4);
  if (!line2.includes("12.4") || !line2.includes("4 completed")) {
    failures.push(fail("timeframe-cite", line2));
  }

  if (!isInterpretation("research_report") || !isInterpretation("library_correction") || isInterpretation("job_note")) {
    failures.push(fail("gate-kind", "Interpretation gate classified a write wrong."));
  }
  if (!isFactWrite("permit_scout_pull") || !isFactWrite("date_field") || isFactWrite("weekly_self_update")) {
    failures.push(fail("fact-kind", "Fact write-through classified a write wrong."));
  }

  const required = [
    "jobs",
    "notes",
    "dates",
    "corrections_library",
    "noa_library",
    "forms_library",
    "building_department",
    "jurisdiction_timeframe",
    "contractor_registration",
    "noc_routing",
    "hoa_tracker",
    "hoa_scout",
    "research_reports",
    "permit_scout_notes",
  ];
  if (SEARCH_SOURCES.join() !== required.join()) {
    failures.push(fail("search-sources", SEARCH_SOURCES.join(", ")));
  }

  return failures;
}
