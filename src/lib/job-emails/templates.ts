export type EmailTemplateId = "engineering" | "hoa" | "supplier" |"noc" |  "blank";

export type JobMailContext = {
  jobNumber: string;
  clientName: string;
  address: string;
  orgName: string;
};

export const EMAIL_TEMPLATES: { id: EmailTemplateId; label: string }[] = [
  { id: "engineering", label: "Engineering request" },
  { id: "hoa", label: "HOA request" },
  { id: "supplier", label: "Supplier / product approval" },  { id: "noc", label: "Notice of Commencement" },
  { id: "blank", label: "Blank" },
];

const signOff = (ctx: JobMailContext) => `Thank you,\n${ctx.orgName || "PermitAIO"}`;

const jobBlock = (ctx: JobMailContext) =>
  [`Job #: ${ctx.jobNumber}`, `Client: ${ctx.clientName}`, `Address: ${ctx.address}`].join("\n");

export function applyTemplate(id: EmailTemplateId, ctx: JobMailContext): { subject: string; body: string } {
  const ref = `Job ${ctx.jobNumber} - ${ctx.clientName} - ${ctx.address}`;
  switch (id) {
    case "engineering":
      return {
        subject: `Engineering request - ${ref}`,
        body: [
          "Hello,",
          "",
          "Please provide signed and sealed engineering for the following project:",
          "",
          jobBlock(ctx),
          "",
          "Scope / details:",
          "- ",
          "",
          "Reply to this email with the signed and sealed documents attached. Your reply and its attachments are filed on the job automatically.",
          "",
          signOff(ctx),
        ].join("\n"),
      };
    case "hoa":
      return {
        subject: `HOA request - ${ref}`,
        body: [
          "Hello,",
          "",
          "We are requesting HOA approval for the following project:",
          "",
          jobBlock(ctx),
          "",
          "Please reply with the approval or any items needed. Attachments sent back to this email are filed on the job automatically.",
          "",
          signOff(ctx),
        ].join("\n"),
      };
    case "supplier":
      return {
        subject: `Product approval request - ${ref}`,
        body: [
          "Hello,",
          "",
          "Please send the current product approval / installation details for this project:",
          "",
          jobBlock(ctx),
          "",
          "Product / series:",
          "- ",
          "",
          signOff(ctx),
        ].join("\n"),
      };
    case "noc": return { subject: `Notice of Commencement - ${ref}`, body: ["Hello,", "", "Your permit is ready to move forward once the Notice of Commencement (NOC) is completed and recorded.", "", jobBlock(ctx), "", "Please complete, sign, and record the NOC with the county, then reply to this email with a copy of the recorded document attached. Your reply and its attachments are filed on the job automatically.", "", signOff(ctx)].join("\n") };
    default: return { subject: `Job ${ctx.jobNumber} - ${ctx.clientName}`, body: `\n\n${signOff(ctx)}` };
  }
}
