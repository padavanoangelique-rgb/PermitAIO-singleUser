export type FieldTool = {
  slug: string;
  file: string;
  title: string;
  blurb: string;
  group: "Windows & Doors" | "Enclosures" | "Any Trade";
};

export const FIELD_TOOLS: FieldTool[] = [
  {
    slug: "egress-calculator",
    file: "egress-calculator.html",
    title: "Egress Opening Calculator",
    blurb: "Compare Single Hung, Casement, and Horizontal Roller against FBC/IRC R310.",
    group: "Windows & Doors",
  },
  {
    slug: "window-wall-designer",
    file: "window-wall-designer.html",
    title: "Window Wall Designer",
    blurb: "Lay out units, bucks, and mullions in one opening. Drag to size, pick the type, print a shop drawing.",
    group: "Windows & Doors",
  },
  {
    slug: "photo-report",
    file: "photo-report.html",
    title: "Photo Report",
    blurb: "Numbered field photos with room and note. Print a labeled PDF.",
    group: "Any Trade",
  },
  {
    slug: "noa-lookup",
    file: "noa-lookup.html",
    title: "NOA / FL Product Approval",
    blurb: "Search common South Florida window and door products for NOA, HVHZ, DP, and expiration.",
    group: "Windows & Doors",
  },
  {
    slug: "rough-opening-calculator",
    file: "rough-opening-calculator.html",
    title: "Rough Opening Calculator",
    blurb: "Convert between unit size, rough opening, and masonry opening with shim gaps.",
    group: "Windows & Doors",
  },
  {
    slug: "design-pressure-calculator",
    file: "design-pressure-calculator.html",
    title: "Design Pressure Estimator",
    blurb: "ASCE 7 components & cladding method — estimate the DP an opening needs.",
    group: "Windows & Doors",
  },
  {
    slug: "energy-code-check",
    file: "energy-code-check.html",
    title: "Energy Code Check (U & SHGC)",
    blurb: "Check NFRC U-factor and SHGC against the 2023 FBC-EC prescriptive path.",
    group: "Windows & Doors",
  },
  {
    slug: "patio-enclosure-permit-guide",
    file: "patio-enclosure-permit-guide.html",
    title: "Sunroom / Patio Checklist",
    blurb: "Quick field questions, photos, and a report you can attach to the job.",
    group: "Enclosures",
  },
  {
    slug: "property-appraisers",
    file: "property-appraisers.html",
    title: "Property Appraisers",
    blurb: "Direct links to Miami-Dade, Broward, Palm Beach, Martin, and Indian River.",
    group: "Any Trade",
  },
];

export const FIELD_TOOL_GROUPS = ["Windows & Doors", "Enclosures", "Any Trade"] as const;

export function fieldToolBySlug(slug: string): FieldTool | undefined {
  return FIELD_TOOLS.find((t) => t.slug === slug);
}
