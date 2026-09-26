import type { MemberRole } from "@/lib/data/orgs";

/** Roles an invite can carry. Owner is intentionally excluded — that role
 * only ever exists by creating the org, or (in future) an explicit
 * ownership-transfer flow.
 *
 * Kept in its own file (no server-only imports) so client components can
 * import it directly without pulling in next/headers via invites.ts. */
export type InvitableRole = Exclude<MemberRole, "owner">;
export const INVITABLE_ROLES: InvitableRole[] = ["admin", "accounting", "manager", "member"];
