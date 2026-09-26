import type { MemberRole } from "@/lib/data/orgs";

const COMPANY_ADMINS = [
  "permit@guardwhatmatters.com",
  "permits@guardwhatmatters.com",
];

export function isCompanyInstallAdmin(email?: string | null, role?: MemberRole | null) {
  const normalized = (email ?? "").trim().toLowerCase();
  if (COMPANY_ADMINS.includes(normalized)) return true;
  if (role === "owner" || role === "admin") return true;
  return false;
}

export function canSeeInstallBoard(
  _role?: MemberRole,
  _email?: string | null,
  _isPlatformAdmin = false,
): boolean {
  return true;
}
