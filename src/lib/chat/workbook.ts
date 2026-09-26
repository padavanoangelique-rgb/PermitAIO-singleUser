import { shopMailboxes } from "./mailboxes";

export type WorkbookNoteId =
  | "ideas"
  | "notes"
  | "info"
  | "next"
  | "inspections"
  | "mail"
  | "teach"
  | "main"
  | "permit"
  | "hoa"
  | "support"
  | "investigator"
  | "forms"
  | "corrections";

export const NOTE_LABELS: Record<WorkbookNoteId, string> = {
  ideas: "Ideas I want to add",
  notes: "My notes",
  info: "Information I want him to know — paste anything",
  next: "Next things to load / set up",
  inspections: "Inspection info to teach him",
  mail: "Mail / alias notes",
  teach: "Reports I still need to load",
  main: "Notes for Main",
  permit: "Notes for Permit desk",
  hoa: "Notes for HOA desk",
  support: "Notes for Support",
  investigator: "Notes for Investigator",
  forms: "Notes for Form Specialist",
  corrections: "Correction lessons to feed",
};

export const AGENTS = [
  {
    id: "main" as const,
    name: "Main",
    who: "Anyone in the company",
    use: "On the phone. Full recap: permit, HOA, product, dates, cycle time.",
    say: "What’s going on with job #____ / client ____?",
    note: "main" as WorkbookNoteId,
  },
  {
    id: "permit" as const,
    name: "Permit",
    who: "Permit techs only",
    use: "Packet, city, NOA, forms, cycle time. Step-by-step submittal.",
    say: "City + trade. What do they want? Which forms? Step by step.",
    note: "permit" as WorkbookNoteId,
  },
  {
    id: "corrections" as const,
    name: "Corrections",
    who: "Permit techs — city comments and letters",
    use: "Upload the letter or paste the comment. He searches the job, the city, past lessons, and the library. Say Save this when the answer is right.",
    say: "Paste comment 2 / attach the letter. Or: what did Weston ask last time on impact?",
    note: "corrections" as WorkbookNoteId,
  },
  {
    id: "hoa" as const,
    name: "HOA",
    who: "HOA techs only",
    use: "Contacts, guidelines, meetings, turnaround, that job’s HOA status.",
    say: "Association or job #.",
    note: "hoa" as WorkbookNoteId,
  },
  {
    id: "support" as const,
    name: "Support",
    who: "Anyone — you approve the fix",
    use: "App broke. It logs. Nothing goes live until you say so.",
    say: "What I clicked. Job #. Error text.",
    note: "support" as WorkbookNoteId,
  },
] as const;

export const SPECIALISTS = [
  {
    id: "investigator" as const,
    name: "Investigator",
    who: "You don’t open this. Manager consults it.",
    use: "Code, checklists, how to submit, city asks.",
    note: "investigator" as WorkbookNoteId,
  },
  {
    id: "forms" as const,
    name: "Permit Form Specialist",
    who: "You don’t open this. Manager consults it.",
    use: "Which forms are actually on file for that city.",
    note: "forms" as WorkbookNoteId,
  },
] as const;

export function mailboxesForShop(slug: string) {
  return shopMailboxes(slug);
}

/** @deprecated use mailboxesForShop(orgSlug) — "client" means the company name */
export const MAILBOXES = shopMailboxes("guardian");

export const LOADED = [
  "Miami-Dade / Broward / Palm Beach ZIP checklists",
  "How to read Florida Building Code (method, not the code book)",
  "Which form packs are on file",
] as const;

export const NOT_LOADED = [
  "Inspections (rough / final / what the inspector wants / how each city schedules)",
  "Google aliases named after each shop — guardian_permitagent@ / guardian_hoaagent@ on agent@",
] as const;

export const TEACH_WAYS = [
  {
    title: "Libraries",
    how: "New form, NOA, building-dept note, HOA contact. Put it in Libraries. Don’t paste it into chat.",
  },
  {
    title: "Research report",
    how: "Investigator or Form Specialist finished a report. Ask PermitAIO → Feed a research report. Paste. Pick who wrote it. County / city. Load into him.",
  },
  {
    title: "Correction lesson",
    how: "City sent a comment. Open the job → Feed a correction. Paste what they asked. Attach the letter. Optional: what cleared it. He keeps it as a city lesson.",
  },
  {
    title: "Change a rule",
    how: "Tell Manager in this Grok chat, or write it on Settings → Grok Manager.",
  },
] as const;
