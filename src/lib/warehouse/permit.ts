export const APPROVED_SUB_STATUSES = new Set(["Approved", "Approved and Printed", "Complete"]);

export function permitIsApproved(subStatus: string | null | undefined) {
  return APPROVED_SUB_STATUSES.has(subStatus ?? "");
}

export function hoaIsApproved(status: string | null | undefined) {
  if (!status) return true;
  return APPROVED_SUB_STATUSES.has(status);
}
