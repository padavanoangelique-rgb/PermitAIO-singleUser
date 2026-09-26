export const ASSIGNED_DEST: Record<string, string> = {
  admin: "/dashboard",
  manager: "/dashboard",
  accounting: "/accounting",
  member: "/dashboard",
  permit_tech: "/inventory",
  hoa_tech: "/hoa",
  measure: "/measure",
  sales: "/sales",
  warehouse: "/warehouse",
  install_manager: "/install",
  account_manager: "/install",
  project_manager: "/install",
  installer: "/install",
  service_manager: "/service",
  service_tech: "/service",
  runner: "/runner",
};

export const OFFICE_ASSIGN_ROLES: { value: string; label: string }[] = [
  { value: "permit_tech", label: "Permit tech" },
  { value: "hoa_tech", label: "HOA tech" },
  { value: "measure", label: "Measure tech" },
  { value: "sales", label: "Sales" },
  { value: "warehouse", label: "Warehouse" },
];

export type AssignedRoleRow = {
  id: string;
  email: string;
  role: string;
  tech_slot: string | null;
};
