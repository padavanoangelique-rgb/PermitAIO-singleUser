export type RoleGuide = {
  slug: string;
  role: string;
  app: string;
  beat: string;
  purpose: string;
  features: string[];
  can: string[];
  how: string[];
  never: string[];
  login: boolean;
};

export const ROLE_GUIDES: RoleGuide[] = [
  {
    slug: "sales",
    role: "Sales",
    app: "Sales board",
    beat: "Sales",
    purpose:
      "Look up the job number. See HOA and permit status. Send the status link if they do not have it. Request an update on the job. Add notes for permitting and install. Tools on the job for egress, design pressures, and other checks.",
    features: [
      "Look up by job number — sales does not create the job",
      "Live permit + HOA status",
      "Status link to copy, text, or email (homeowner or HOA)",
      "Notes for permitting and install on this job",
      "Request an update directly on the job",
      "Egress / design-pressure tools on the job",
    ],
    can: [
      "Search any job by number",
      "Send or resend the status link",
      "Add notes and request an update",
    ],
    how: [
      "Login → Sales",
      "Search by job number",
      "Send the link",
      "Add a note or request an update if needed",
    ],
    never: [
      "Do not create the job",
      "No office login for the homeowner",
      "No money in this app",
    ],
    login: true,
  },
  {
    slug: "measure-tech",
    role: "Measure Tech",
    app: "Measure",
    beat: "Measure",
    purpose:
      "Shoot the openings on the existing job number. Photos and sizes land on the floor plan so permit does not re-measure.",
    features: [
      "Pull the job by number — do not create a new one",
      "Photos of each opening on the job",
      "Width / height typed on the existing plan",
      "Submit so the permit tech can draw",
    ],
    can: [
      "Open the assigned job",
      "Photograph openings",
      "Save sizes to the job",
    ],
    how: [
      "Login → Measure",
      "Search the job number",
      "Shoot openings",
      "Submit",
    ],
    never: [
      "Do not invent a job number",
      "Do not submit the permit",
      "Do not assign install",
    ],
    login: true,
  },
  {
    slug: "permit-tech",
    role: "Permit Tech",
    app: "Jobs · Floor Plans · Forms · Package",
    beat: "Permit",
    purpose:
      "Move the permit track from intake to submitted / approved so warehouse and install can unlock.",
    features: [
      "Jobs — My Jobs / All Jobs, KPI cards",
      "Master report: status, owner, age, stage, value",
      "Floor plan: click plan, type W/H in the grid only",
      "Official city schedule (never a look-alike grid)",
      "Forms generator + permit package ZIP",
    ],
    can: [
      "Own jobs assigned to you",
      "Draw plan, fill official forms, build package",
      "Update permit status on this job only",
    ],
    how: [
      "Login → Jobs → My Jobs",
      "Open the job number",
      "Confirm name + full address",
      "Plan → official schedule → package → submit",
    ],
    never: [
      "No fake schedules",
      "No second job for the same house",
      "Do not mark install ready",
      "Do not draw a second floor plan for HOA",
    ],
    login: true,
  },
  {
    slug: "hoa-tech",
    role: "HOA Tech",
    app: "HOA Tracker · Jobs · Permit Builder",
    beat: "HOA",
    purpose: "Clear or mark HOA on the same job number so Ready is not blocked.",
    features: [
      "HOA Tracker — FL associations + management cos",
      "Job HOA tab — pending / submitted / approved / not required",
      "Same job number as the permit tech",
      "Permit Builder: forms, floor plan, and package on that job",
      "Homeowner link reads this status in plain English",
    ],
    can: [
      "Look up the association and what they require",
      "Submit the HOA package",
      "Mark Not required when there is no HOA",
      "Use Forms Generator, Floor Plans, and Permit Package on the job",
    ],
    how: [
      "Login → Jobs, HOA Tracker, or Permit Builder",
      "Open the job number",
      "Match the association",
      "Use the floor plan already on the job — do not redraw it",
      "Submit → update status",
    ],
    never: [
      "Do not invent an HOA",
      "Do not touch permit status",
      "No second record for the address",
      "Do not draw a second floor plan",
    ],
    login: true,
  },
  {
    slug: "warehouse",
    role: "Warehouse",
    app: "Warehouse",
    beat: "Whse",
    purpose:
      "When product arrives, search the job number. Check every unit off the checklist. Hand the Install Manager that checklist so the job can be scheduled.",
    features: [
      "Pull by job number — blank until you pull",
      "Checklist from floor plan: loc, type, W, H, NOA",
      "Manual window/door count if no plan yet",
      "Check-in + Flag broken (note + photo)",
      "Checklist PDF — hand to Install Manager when complete",
      "Notifies permit tech if product arrives early",
    ],
    can: [
      "Check each opening In",
      "Flag broken product on that job",
      "Print a paper checklist",
    ],
    how: [
      "Login → Warehouse",
      "Type job number → Pull job",
      "Check In on each unit",
      "Flag broken if needed",
    ],
    never: [
      "No product off the NOA list",
      "Do not mark Ready",
      "Do not change permit/HOA",
    ],
    login: true,
  },
  {
    slug: "permit-runner",
    role: "Permit Runner",
    app: "Permit Runner",
    beat: "Runner",
    purpose:
      "Check the package in and out of the building department. Time on the job is recorded. The office sees where the package is.",
    features: [
      "Your assigned runs only",
      "Check in at the building department",
      "Check out when you leave",
      "Duration and notes on the same job number",
    ],
    can: [
      "Open today's runs",
      "Check in / check out",
      "Add a note if they hold the package",
    ],
    how: [
      "Login → Permit Runner",
      "Tap the job number",
      "Check in on arrival",
      "Check out when you leave",
    ],
    never: [
      "Do not change permit status",
      "Do not edit the floor plan",
      "Do not take payment",
    ],
    login: true,
  },
  {
    slug: "install-manager",
    role: "Install Manager",
    app: "Install board · Roster",
    beat: "Install",
    purpose:
      "Once warehouse checks the job in, it appears on your board to assign and schedule.",
    features: [
      "Overview of all installs and jobs",
      "Project-manager touches on each job",
      "Inspections",
      "Money collected",
      "Installer selected",
      "Installer invoices",
    ],
    can: [
      "See every install and who touched it",
      "Assign PM / installer and schedule",
      "See inspections, money collected, installer invoices",
    ],
    how: [
      "Login → Install",
      "Job appears after warehouse check-in",
      "Assign PM / installer",
      "Schedule the work",
    ],
    never: [
      "No invented job numbers",
      "No floor-plan edits",
      "Do not change permit or HOA",
    ],
    login: true,
  },
  {
    slug: "account-manager",
    role: "Account Manager",
    app: "Install (assigned jobs)",
    beat: "Install",
    purpose:
      "Keep the customer and the job number aligned after the permit office hands it off.",
    features: [
      "Install list filtered to your jobs",
      "Job number, address, customer on one row",
      "Same record sales and permit already use",
    ],
    can: [
      "Confirm name / address / job number",
      "Send a mismatch back to the permit office",
      "Tell Install Manager when a PM can take it",
    ],
    how: [
      "Login → Install",
      "Open your assigned job",
      "Match the handoff",
      "Flag errors — do not rebuild the job",
    ],
    never: [
      "Do not add jobs (unless also IM)",
      "Do not take payment",
      "Do not guess from an address",
    ],
    login: true,
  },
  {
    slug: "project-manager",
    role: "Project Manager",
    app: "Install · Schedule",
    beat: "Install",
    purpose:
      "Check the job in, put an installer on the calendar, record inspection — still one job number.",
    features: [
      "Route / schedule",
      "Photos on the job",
      "Keep track of every job you manage",
      "Assign installer + install / inspection date",
      "Inspection: scheduled / passed / failed",
    ],
    can: [
      "Check the job in after product + site check",
      "Schedule the installer",
      "Write inspection result on this job",
    ],
    how: [
      "Login → Install",
      "Open the job number",
      "Check in",
      "Assign installer + date",
    ],
    never: [
      "Do not mark Ready if permit/HOA open",
      "No money",
      "Do not change permit status",
    ],
    login: true,
  },
  {
    slug: "installer",
    role: "Installer",
    app: "Install (your jobs only)",
    beat: "Install",
    purpose:
      "Install the assigned openings, request inspection, and upload receipts and invoices right to the job.",
    features: [
      "Only jobs assigned to you",
      "Job number, address, product on the card",
      "Photos / request inspection",
      "NOA list is the product list — no extras",
    ],
    can: [
      "Open your assigned job",
      "Confirm address vs truck",
      "Request inspection",
      "Upload receipts and invoices to the job",
    ],
    how: [
      "Login → Install",
      "Tap the job number",
      "Match product to the NOA list",
      "Finish → request inspection → upload receipts",
    ],
    never: [
      "No pay screen",
      "Do not add jobs",
      "Do not install off-list product",
    ],
    login: true,
  },
  {
    slug: "accounting",
    role: "Accounting",
    app: "Accounting",
    beat: "Office",
    purpose:
      "See every fee receipt as it is uploaded and the running ledger. Installer invoices sit next to it. Admin and accounting only.",
    features: [
      "Live ledger with running total",
      "Open the receipt file on the row",
      "Installer invoices in the same view",
      "Hidden from permit / HOA / field logins",
    ],
    can: [
      "Open Accounting from the footer next to Settings",
      "Filter by date",
      "Download the receipts report",
    ],
    how: [
      "Login → Accounting",
      "Read the ledger",
      "Open a receipt",
      "Export if you need paper",
    ],
    never: [
      "Do not change permit or HOA status",
      "Do not assign install",
    ],
    login: true,
  },
  {
    slug: "admin",
    role: "Admin",
    app: "Dashboard · Settings · Accounting",
    beat: "Office",
    purpose:
      "Run the office. Assign techs, contractors, libraries, and the accounting seat. See every job on the dashboard.",
    features: [
      "Full dashboard: permit techs, HOA techs, account managers",
      "Assign jobs, ordered date, material ETA",
      "Libraries, contractors, COI expirations",
      "Team roles including Accounting",
    ],
    can: [
      "Assign any tech",
      "Open Accounting",
      "Invite teammates",
      "Manage contractors and libraries",
    ],
    how: [
      "Login → Dashboard",
      "Assign the job",
      "Open Settings for seats and roles",
    ],
    never: [
      "Do not give field logins office-wide access",
      "Do not skip HOA before Ready",
    ],
    login: true,
  },
  {
    slug: "homeowner",
    role: "Homeowner",
    app: "Track link (no login)",
    beat: "Homeowner",
    purpose:
      "See permit and HOA in plain English without calling the office. One link, branded as your contractor.",
    features: [
      "No password — tap the text/email link",
      "Contractor name / logo at the top",
      "Job number + address",
      "Permit stage + ETA",
      "HOA stage + ETA",
      "Updates when the office updates the job",
    ],
    can: [
      "Refresh the same link anytime",
      "See if sharing was paused",
      "Ask your contractor if the link dies",
    ],
    how: [
      "Wait for the contractor’s text or email",
      "Tap the link — no account",
      "Read permit + HOA",
      "Refresh later — same URL",
    ],
    never: [
      "Do not use permiteaio.com/login",
      "No prices or office notes on this page",
      "Do not blast the link",
    ],
    login: false,
  },
];

export function roleGuideBySlug(slug: string | undefined) {
  return ROLE_GUIDES.find((r) => r.slug === slug) ?? ROLE_GUIDES[0];
}
