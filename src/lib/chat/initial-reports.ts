/** Starting brain from Investigator + Permit Form Specialist.
 * Source: Drive AIO county checklists + forms packs (loaded 2026-09-20). */
export type SeedReport = {
  agent: "investigator" | "forms_specialist";
  county?: string;
  jurisdiction?: string;
  title: string;
  body: string;
};

export const INITIAL_REPORTS: SeedReport[] = [
  {
    agent: "investigator",
    county: "Miami-Dade",
    title: "Miami-Dade window/door package checklist",
    body: `Use this as the ZIP readiness list. Confirm live county forms each quarter. Swap names when the official PDF title differs.

ALWAYS IN THE ZIP
- Permit application (current Miami-Dade window/door or building application)
- Floor plan from PermitAIO (auto-calculated openings, address, folio in title block)
- Opening schedule (ID, type, size, series, config)
- NOAs / FL product approvals matched to the schedule
- Contractor license info as required on the form
- Owner / applicant fields complete
- Folio in Miami-Dade format
- HOA approval letter if the job is in an HOA that requires it
- Notice of commencement status noted if the job value triggers it (confirm current threshold)

CHECK BEFORE GENERATE
- County = Miami-Dade, not Broward
- Product series on the schedule matches the NOA pages in the ZIP
- Address on floor plan = address on application

OUT
Do not put internal notes, CRM exports, or other counties’ forms in this ZIP.`,
  },
  {
    agent: "investigator",
    county: "Broward",
    title: "Broward window/door package checklist",
    body: `Confirm live municipality vs county intake. Many Broward jobs file with the city, not unincorporated county. Update quarterly.

ALWAYS IN THE ZIP
- Current Broward or city window/door application used by that jurisdiction
- Floor plan from PermitAIO
- Opening schedule
- NOAs / FL approvals matched to schedule
- Contractor license
- Folio / property ID in the format that city wants
- HOA letter if required
- Product approvals that Broward still expects as NOA or FL#

CHECK BEFORE GENERATE
- Jurisdiction is the city they actually file in
- Folio did not stay in Miami-Dade format
- Schedule openings = floor plan tags

OUT
No other-county applications. No expeditor correspondence unless the shop asked it in the packet.`,
  },
  {
    agent: "investigator",
    county: "Palm Beach",
    title: "Palm Beach window/door package checklist",
    body: `PBC and municipalities split intake. Confirm the AHJ (who actually takes the package). Update quarterly.

ALWAYS IN THE ZIP
- Current PBC or municipal application
- Floor plan from PermitAIO
- Opening schedule
- Product approvals (NOA / FL#) matched to schedule
- Contractor license
- PCN / folio in Palm Beach format
- HOA letter if required

CHECK BEFORE GENERATE
- County/city is Palm Beach side, not Miami-Dade or Broward
- PCN matches the job address
- Every scheduled opening has an approval page

OUT
Do not include template masters from other counties.`,
  },
  {
    agent: "investigator",
    title: "Florida Building Code research method (8th Edition 2023 baseline)",
    body: `Source: Florida Building Code Study Guide, loaded 2026-09-20. This is a research method, NOT the adopted code text. Numerical workbook examples are invented. Confirm the governing edition, supplements, and local amendments for every real job.

EDITION
- Study baseline: 8th Edition (2023), effective Dec 31, 2023.
- As of 2026-09-20 the 9th Edition (2026) was listed as draft. Confirm what the AHJ actually uses.
- Cite volume + edition + section. Never quote a number from this workbook as a design criterion.

FOUR QUESTIONS BEFORE RESEARCH
1. Where is the property and which authority has jurisdiction?
2. Building use, size, height, and which volume applies?
3. New work, repair, alteration, addition, or change of occupancy?
4. Which edition, supplements, and amendments govern this permit?

VOLUMES
Building | Residential | Existing Building | Energy Conservation | Accessibility | Mechanical / Plumbing / Fuel Gas | Test Protocols for HVHZ.
A residential use does not by itself mean the Residential volume applies. Identify the Existing Building compliance method before using an isolated exception.

DO NOT MIX
- What performance is required? → code, standards, project design.
- How may this product be installed? → approval, install instructions, approved details.
- What must I upload? → that AHJ's current checklist.

READ THE WHOLE RULE: scope, definitions, main text, exceptions, tables/footnotes, cross-references, then the drawing/product that proves it.

HVHZ / WIND (South Florida)
- HVHZ = Miami-Dade and Broward. Palm Beach is outside HVHZ. That does NOT remove wind-load or windborne-debris requirements.
- Wind speed (mph) is not design pressure (psf). Do not copy a neighbor job's criteria.
- Check + and − separately on the same design basis.
- Impact resistance does not, by itself, prove pressure capacity or escape/glazing compliance.
- Approval review: exact manufacturer, model, approval number, revision, status, edition, HVHZ eligibility, size, glass, anchors, substrate, install details. Select the exact configuration.

WINDOWS / DOORS — seven passes
Identity (same ID on plan, schedule, product) | Scope (replace in existing opening vs enlarge) | Life safety (escape, egress, safety glazing, fall protection) | Wind (demand vs that configuration) | Attachment (actual substrate, anchors, embedment, spacing, edge distance) | Assembly (mullions — two approved units do not prove the combo) | Envelope (flashing, water, energy).

EMERGENCY ESCAPE
Nominal size is not clear opening. Record net clear area, width, height, floor-to-bottom-of-clear-opening, operation, and any exception. Start at Residential R310 (verify the governing subsection). Impact rating does not answer the escape question.

STUDY STARTING POINTS (verify in the governing edition)
R301 design | R308 glazing | R310 emergency escape | R311 egress | R312 guards | R609 exterior windows and doors. Building Ch. 16 and 24. HVHZ test protocols when that zone applies.

ROOFING / EXISTING
Think in assemblies: deck, attachment, underlayment, covering, flashing, penetrations, edges, drainage.
Do not treat “over 25 percent always replace the whole roof” as a slogan. Read the current Existing Building rule (study pointer: 706.1.1), exceptions, supplements, and the facts: area, section boundaries, prior work, existing assembly. Percentage alone is not enough.

CONCLUSIONS THE AGENT MAY USE
Supported | Not supported | Undetermined (missing fact) | Refer for review (design/professional needed).
If a fact is missing, say undetermined and list what to get. Never invent a citation.`,
  },
  {
    agent: "investigator",
    title: "Tri-county submittal rules (Investigator)",
    body: `South Florida window/door permits: Miami-Dade, Broward, Palm Beach.

JOB NUMBER is the source of truth. One package per job.

BEFORE YOU FILE
1. Confirm the AHJ — the city or county that actually intakes this address. Broward and Palm Beach often file with the city, not the county.
2. County on the job must match the forms in the ZIP. Never mix Miami-Dade, Broward, and Palm Beach applications.
3. Folio / PCN format must match that county. Miami-Dade folio is not Palm Beach PCN.
4. Floor plan address = application address = job address.
5. Every opening on the schedule has a matching NOA or FL# page.
6. HOA letter only if that association requires it. Do not invent an HOA.
7. Confirm live application PDF quarterly — titles change.

HVHZ / WIND
Miami-Dade and Broward are High Velocity Hurricane Zone. Product must be approved for HVHZ when that is required. Do not invent a design pressure. Use the NOA / FL# and the job’s design pressures on file.

STILL UNKNOWN until confirmed on the job or in Libraries
- Exact current application PDF title for that city
- Current NOC dollar threshold
- That city’s extra local forms beyond the county default
- Fees and cycle time (use the job’s dates, do not guess)`,
  },
  {
    agent: "forms_specialist",
    title: "Permit Form Specialist — what is on file",
    body: `FORMS ON FILE (shop Drive packs + PermitAIO Libraries)
- Miami-Dade permit forms pack
- Broward permit forms pack
- Palm Beach permit forms pack
- Combined renamed forms pack
- Libraries → Forms (by county). Use whatever is actually listed there for that city. If it is not in Libraries, it is NOT ON FILE.

DEFAULT APPLICATION NAMES (swap when the live PDF title differs)
- Miami-Dade: county window/door or building application
- Broward: county or city window/door application for that jurisdiction
- Palm Beach: PBC or municipal application for that AHJ

EVERY WINDOW/DOOR PACKET ALSO NEEDS
- Floor plan from PermitAIO
- Opening schedule
- Matched NOA / FL# pages
- Contractor license
- Correct folio / PCN
- HOA letter only if required

MUST FILE vs NOT ON FILE
- MUST FILE: current application for that AHJ + plan + schedule + matching approvals + license + folio
- NOT ON FILE: do not invent a form title. Say it is not in Libraries and name the county.

NEVER
- Put another county’s application in this ZIP
- Use a Miami-Dade folio on a Broward or Palm Beach job
- Quote a form that is not in Libraries or this report`,
  },
];

export function isHowToQuery(query: string) {
  const q = query.toLowerCase();
  return /how (do|to)|checklist|what (does|do they|does the city)|prepare|which form|packet|application|building code|\bfbc\b|hvhz|submittal step|correction|comment|letter|revise|city asked/.test(
    q,
  );
}

export function matchSeedReports(query: string, countyHint?: string | null): SeedReport[] {
  const q = query.toLowerCase().replace(/[%_]/g, " ").trim();
  if (q.length < 3) return [];
  const howTo = isHowToQuery(q);
  const countyFromQuery = /miami[-\s]?dade/.test(q)
    ? "Miami-Dade"
    : /broward/.test(q)
      ? "Broward"
      : /palm beach/.test(q)
        ? "Palm Beach"
        : countyHint ?? null;
  if (!howTo && !countyFromQuery) return [];

  const byCounty = (name: string) =>
    INITIAL_REPORTS.filter((r) => r.county?.toLowerCase() === name.toLowerCase());
  const general = INITIAL_REPORTS.filter((r) => !r.county);

  if (countyFromQuery) {
    const hit = byCounty(countyFromQuery);
    return howTo ? [...hit, ...general].slice(0, 3) : hit.slice(0, 1);
  }
  if (howTo) return general.slice(0, 2);
  return [];
}
