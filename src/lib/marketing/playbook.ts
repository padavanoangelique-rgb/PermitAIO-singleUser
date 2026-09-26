export type PlaybookRole = {
  slug: string;
  role: string;
  stage: string;
  lands: string;
  first: string[];
  clicks: { title: string; steps: string[] }[];
  reports: string[];
  agents: string[];
  never: string[];
};

export const EVERYONE_AGENTS = [
  "Purple Ask PermitAIO button — bottom right of every office page.",
  "Main — anyone. On the phone: job # or client name. Full recap (permit, HOA, orders, dates).",
  "Permit — permit techs. Submittals, forms, code, that job’s permit side.",
  "HOA — HOA techs. Contacts, notes, meetings, turnaround.",
  "Support — something in the app broke. Logged for owner approval. Nothing goes live until then.",
  "He searches. He does not invent. Job number is the truth.",
];

export const PLAYBOOK: PlaybookRole[] = [
  {
    slug: "admin",
    role: "Owner / Admin",
    stage: "Office",
    lands: "Dashboard",
    first: [
      "Go to permiteaio.com. Sign in (you already have the account).",
      "Settings → Join code → set the 4-digit code → Save code → Print sign-in sheet.",
      "Assign each person before they join (Office apps, Install team, Service team, Permit Runner).",
      "Hand them the sheet. They go to permiteaio.com, enter company name + code + their email, create a password.",
    ],
    clicks: [
      {
        title: "Assign a person",
        steps: [
          "Left rail → Settings.",
          "Office apps → pick Permit tech / HOA tech / Measure tech / Sales / Warehouse → type their email → Assign role.",
          "Install team → Add to install team → Account manager / Project manager / Installer.",
          "Service team → Add service tech. Service manager → Assign service manager.",
          "Permit Runner → Add runner.",
          "Team → Invite member only for admin / accounting / manager / member seats.",
        ],
      },
      {
        title: "Open the day",
        steps: [
          "Left rail → Dashboard.",
          "KPI cards: Active jobs, Need to submit, In review, Approved / printed, Needs attention. Tap a card to filter. Clear filter to reset.",
          "Team status → tap a tech name, or Open board.",
          "New job (or Permit Inventory → Add job) → Create job.",
          "Tap the job # pill → set Permit tech and HOA tech. Set Job ordered and Material ETA if you have them.",
        ],
      },
    ],
    reports: [
      "Dashboard → Print master report → Portrait or Landscape (horizontal).",
      "Settings → Join code → Print sign-in sheet.",
      "Settings → Print Ask PermitAIO how-to.",
      "Accounting (footer) → Receipts → Day’s / Week’s / Custom / All-time.",
    ],
    agents: [
      "Ask PermitAIO → Main for any recap.",
      "Settings → Grok Manager — change desk rules. Feed a research report → Load into him.",
      "Support tickets wait for your approval — nothing goes live until you say so.",
      "Mail: agent@permitaio.com is the inbox. Each shop gets aliases named after the company: {shop}_permitagent@ and {shop}_hoaagent@ (Guardian → guardian_permitagent@permitaio.com).",
    ],
    never: ["Do not give field logins the whole office sidebar.", "Do not skip HOA before Ready."],
  },
  {
    slug: "sales",
    role: "Sales",
    stage: "Sales",
    lands: "Sales",
    first: [
      "permitaio.com → company name → 4-digit code → your work email → create a password → Create password and join.",
      "You land on Sales. You do not create jobs.",
    ],
    clicks: [
      {
        title: "Look up a job",
        steps: [
          "Type the job number → Pull job.",
          "Read permit + HOA status on the card.",
          "Copy link or Send email for the homeowner/HOA status page.",
          "Need the office: Request update → Ask permit tech or Ask HOA tech.",
          "Save note. Upload PDF if you have one.",
          "Open Tools (egress, design pressure) if you need a check.",
        ],
      },
    ],
    reports: ["No separate sales report. Status is on the job. Homeowner sees the same link."],
    agents: [
      "Ask PermitAIO → Main: “What’s going on with job #____?” while you’re on the phone.",
      "Do not use the Permit or HOA desks unless you also have that role.",
    ],
    never: ["Do not create the job.", "No money in this app.", "No office login for the homeowner."],
  },
  {
    slug: "measure-tech",
    role: "Measure Tech",
    stage: "Measure",
    lands: "Measure Tech",
    first: [
      "Join at permiteaio.com with company code + your email + password.",
      "Left rail → Apps → Measure Tech (or you land there).",
    ],
    clicks: [
      {
        title: "Shoot the house",
        steps: [
          "Type job number → Pull job (Clear to reset).",
          "Draw the house — type W / H on the openings.",
          "Photos & PDF → Take photo and/or Attach PDF.",
          "Submit measure.",
        ],
      },
    ],
    reports: ["Sizes and photos live on the job’s floor plan. Permit tech draws from that — you do not print a separate report."],
    agents: ["Ask PermitAIO → Main if you need the address or job # confirmed."],
    never: ["Do not invent a job number.", "Do not submit the permit.", "Do not assign install."],
  },
  {
    slug: "permit-tech",
    role: "Permit Tech",
    stage: "Permit",
    lands: "Permit Inventory",
    first: [
      "Join at permiteaio.com with company code + your email + password.",
      "You land on Permit Inventory. Dashboard shows only your jobs.",
    ],
    clicks: [
      {
        title: "Work the queue",
        steps: [
          "Left rail → Permit Inventory.",
          "Tap your name chip (or All).",
          "KPI: Need to Submit, Quote Needed, Engineering Pending, In Review, Corrections Needed, Approved, Approved and Printed.",
          "Views: List, Pipeline, or Aging.",
          "Expand the job row → set Permit Status.",
          "Upload printed permit when the city issues it. Print sticker if you need a label. Fees & Receipts for payments.",
        ],
      },
      {
        title: "Build the package",
        steps: [
          "Left rail → Permit Builder.",
          "Chips: All / Drawn / Not started. Open the job.",
          "Floor Plans — one plan per job. Type W/H in the grid. Do not invent a second plan.",
          "Forms Generator → Fill entire pack (or Fill one).",
          "Permit Package → Generate vN → Mark reviewed → Mark submitted.",
          "Tap the job # anytime to see Overview, Requirements & Forms, NOA Downloader, Activity & Notes.",
        ],
      },
    ],
    reports: [
      "Permit Inventory → ⋯ → Reports → Job list / Daily activity / Weekly activity / Monthly activity / Cycle times / To-do list / My performance / Roofing only → Print report.",
      "Job expand → Fees & Receipts → Print fee report.",
      "Dashboard → Print master report (if you can see the whole board).",
    ],
    agents: [
      "Ask PermitAIO → Permit: city + trade, “what do they want, which forms, step by step.”",
      "Main: full recap if you’re on the phone.",
      "City sent a correction: open Ask PermitAIO → Feed a correction → paste what they asked (attach the letter) → Teach him.",
      "Permit mail goes to {shop}_permitagent@permitaio.com (Guardian → guardian_permitagent@permitaio.com) once the alias is live.",
    ],
    never: ["No fake schedules.", "No second job for the same house.", "Do not mark install Ready.", "Do not invent forms or code — if Ask PermitAIO doesn’t have it, say so."],
  },
  {
    slug: "hoa-tech",
    role: "HOA Tech",
    stage: "HOA",
    lands: "HOA Tracker",
    first: [
      "Join at permiteaio.com with company code + your email + password.",
      "You land on HOA Tracker. Same job number as the permit tech.",
    ],
    clicks: [
      {
        title: "Clear the association",
        steps: [
          "Left rail → HOA Tracker.",
          "Add job, or ⋯ → New HOA / Upload jobs CSV.",
          "KPI: Total Jobs, Need to Submit, In Review, Approved, Approved and Printed, Complete.",
          "Tap a tech chip or All.",
          "HOA Directory → Load HOAs to find the association. ← Back to directory when done.",
          "Expand the job → match the association. Upload application. Send to HOA. Save notes.",
          "Mark Not required when there is no HOA. Do not invent one.",
          "Permit Builder on this job: use the floor plan already there — do not redraw it.",
        ],
      },
    ],
    reports: ["HOA Tracker → ⋯ → Print report."],
    agents: [
      "Ask PermitAIO → HOA: association or job # — contacts, notes, meetings, turnaround.",
      "Main: full recap on the phone.",
      "Inbound HOA mail: {shop}_hoaagent@permitaio.com (Guardian → guardian_hoaagent@permitaio.com) sticks to the job.",
    ],
    never: ["Do not invent an HOA.", "Do not touch permit status.", "Do not draw a second floor plan."],
  },
  {
    slug: "warehouse",
    role: "Warehouse",
    stage: "Warehouse",
    lands: "Warehouse",
    first: ["Join at permiteaio.com. Left rail → Apps → Warehouse."],
    clicks: [
      {
        title: "Receive product",
        steps: [
          "Type job number → Pull job. Screen is blank until you pull.",
          "Checklist comes from the floor plan (loc, type, W, H, NOA). No plan yet: type window/door counts → Build checklist.",
          "Tap In on each unit (Check in).",
          "Wrong or damaged: Flag broken → note/photo → Save.",
          "Download checklist PDF and hand it to the Install Manager when the job is complete.",
          "Print job sticker if you need a label. Floor plan if you need to see openings.",
        ],
      },
    ],
    reports: ["Download checklist PDF — that is the handoff to Install."],
    agents: ["Ask PermitAIO → Main if the job # or NOA list is wrong. Do not change permit/HOA yourself."],
    never: ["No product off the NOA list.", "Do not mark Ready.", "Do not change permit or HOA."],
  },
  {
    slug: "permit-runner",
    role: "Permit Runner",
    stage: "Runner",
    lands: "Permit Runner",
    first: ["Join at permiteaio.com. You only see Permit Runner."],
    clicks: [
      {
        title: "Office sends the run",
        steps: ["Apps → Permit Runner → Send a job to the runner → Job / Place / Note → Send.", "Add crew → Add to roster if needed."],
      },
      {
        title: "In the field",
        steps: ["Tap the job card.", "Check in when you arrive at the building department.", "Check out when you leave. Add a note if they hold the package."],
      },
    ],
    reports: ["Permit Runner → Print report."],
    agents: ["Ask PermitAIO → Main for the job address or what to drop. Do not change permit status."],
    never: ["Do not change permit status.", "Do not edit the floor plan.", "Do not take payment."],
  },
  {
    slug: "install-manager",
    role: "Install Manager",
    stage: "Install",
    lands: "Install Dashboard",
    first: [
      "Join at permiteaio.com. You land on Install Dashboard.",
      "If you have more than one field role: Continue as → Install manager.",
    ],
    clicks: [
      {
        title: "Fill the board",
        steps: [
          "Tabs: Overview, Board, Map, Calendar, Permit/HOA status, Installer invoices, Project manager app.",
          "KPI: On board, To schedule, Need AM, Need crew, Scheduled, PM check, Passed, Failed, Money out.",
          "Job appears after warehouse check-in. Expand the job #.",
          "Save AM. Save crew. Checked out permit. PM check in. Save money (Deposit collected, Change order, Contract signed, Final payment collected).",
          "Board admin & money → Add a job to the board → Add. Add crew → Add to roster.",
          "Left rail → Ready to schedule → pick Installer → date → Schedule now.",
          "Permit/HOA status → Pull job → Request update if the office is holding you.",
        ],
      },
    ],
    reports: ["Installer invoices tab.", "Ready to schedule board.", "Photo / money on the job — no separate master print on this app."],
    agents: ["Ask PermitAIO → Main: “Is this job permitted and HOA clear?” before you schedule."],
    never: ["No invented job numbers.", "No floor-plan edits.", "Do not change permit or HOA."],
  },
  {
    slug: "account-manager",
    role: "Account Manager",
    stage: "Install",
    lands: "Install Dashboard",
    first: ["Join at permiteaio.com. Continue as → Account manager if asked."],
    clicks: [
      {
        title: "Handoff",
        steps: [
          "Tap your job #.",
          "Pick Project manager and Installer → Save (scheduled date) → Job details.",
          "Name / address / job number must match. Flag a mismatch back to the permit office — do not rebuild the job.",
          "Permit/HOA status → Pull job if the customer asks.",
        ],
      },
    ],
    reports: ["Your jobs on Install Dashboard. No separate AM report."],
    agents: ["Ask PermitAIO → Main for the customer recap."],
    never: ["Do not add jobs unless you are also Install Manager.", "Do not take payment.", "Do not guess from an address."],
  },
  {
    slug: "project-manager",
    role: "Project Manager",
    stage: "Install",
    lands: "Install Dashboard",
    first: ["Join at permiteaio.com. Continue as → Project manager (or Project manager app)."],
    clicks: [
      {
        title: "Run the route",
        steps: [
          "Best route this morning.",
          "Tap job # → Check in (later: Checked in · tap to update).",
          "Upload photos. Photo report PDF. Job details.",
          "Write inspection on the job when you have it.",
        ],
      },
    ],
    reports: ["Photo report PDF on the job."],
    agents: ["Ask PermitAIO → Main if permit/HOA is still open — do not mark Ready."],
    never: ["Do not mark Ready if permit/HOA is open.", "No money.", "Do not change permit status."],
  },
  {
    slug: "installer",
    role: "Installer",
    stage: "Install",
    lands: "Install Dashboard",
    first: ["Join at permiteaio.com. Continue as → Installer."],
    clicks: [
      {
        title: "Install the openings",
        steps: [
          "Best route this morning.",
          "Tap job # → Job details. Confirm address vs truck.",
          "Match product to the NOA list — no extras.",
          "Upload invoice / Show uploaded. Upload material receipt.",
          "Finish → request inspection.",
        ],
      },
    ],
    reports: ["Your invoice and receipts on the job. Install Manager sees them."],
    agents: ["Ask PermitAIO → Main only if you have office access. Most installer logins are this app only."],
    never: ["No pay screen.", "Do not add jobs.", "Do not install off-list product."],
  },
  {
    slug: "service-manager",
    role: "Service Manager",
    stage: "Service",
    lands: "Service Dashboard",
    first: ["Join at permiteaio.com. Continue as → Service manager if asked."],
    clicks: [
      {
        title: "Assign the ticket",
        steps: [
          "Service Dashboard. KPI: On board, Need tech, Scheduled, Completed.",
          "Add a job to the board → Add. Add crew → Add to roster.",
          "Expand the job → pick Service tech + Date + Status (Open / Scheduled / Completed / Cancelled) → Save assignment → Open job.",
          "Daily report or Weekly report → Print report. ← Service Dashboard to go back.",
          "Service tech app to see their view.",
        ],
      },
    ],
    reports: ["Daily report. Weekly report. Print report."],
    agents: ["Ask PermitAIO → Support if the Service board itself is broken. Main for the original job recap."],
    never: ["Do not change permit or HOA.", "Do not invent a job number."],
  },
  {
    slug: "service-tech",
    role: "Service Tech",
    stage: "Service",
    lands: "Service Dashboard",
    first: ["Join at permiteaio.com. Continue as → Service tech."],
    clicks: [
      {
        title: "Close the ticket",
        steps: [
          "Best route this morning.",
          "Tap job # → Job details.",
          "Take / upload photo · Show uploaded.",
          "Submit service ticket.",
        ],
      },
    ],
    reports: ["Photos on the ticket. Manager prints Daily / Weekly."],
    agents: ["This app only. Call the office if the job # is wrong."],
    never: ["Do not add jobs.", "Do not change permit status."],
  },
  {
    slug: "accounting",
    role: "Accounting",
    stage: "Office",
    lands: "Accounting",
    first: ["Join at permiteaio.com. Footer → Accounting (hidden from field logins)."],
    clicks: [
      {
        title: "Read the ledger",
        steps: [
          "Tabs: Ledger · Receipts.",
          "Receipts → Day’s receipts / Week’s receipts / Custom range / All-time.",
          "Refresh. Clear dates to reset.",
          "Expand a row → Open job or View receipt.",
        ],
      },
    ],
    reports: ["Receipts export: Day / Week / Custom / All-time.", "Installer invoices sit next to the ledger."],
    agents: ["Ask PermitAIO → Main for which job a receipt belongs to. Do not change status."],
    never: ["Do not change permit or HOA status.", "Do not assign install."],
  },
  {
    slug: "homeowner",
    role: "Homeowner",
    stage: "Homeowner",
    lands: "Status link (no login)",
    first: ["Wait for the contractor’s text or email. Tap the link. No password."],
    clicks: [
      {
        title: "Track the job",
        steps: [
          "Read job number + address at the top (contractor name/logo).",
          "Permit stage + ETA. HOA stage + ETA.",
          "Refresh later — same URL.",
        ],
      },
    ],
    reports: ["This page is the report. Nothing to print from the office login."],
    agents: ["No Ask PermitAIO. Call your contractor."],
    never: ["Do not use permiteaio.com/login.", "Do not blast the link."],
  },
];

export function playbookBySlug(slug: string) {
  return PLAYBOOK.find((p) => p.slug === slug) ?? PLAYBOOK[0];
}
