/**
 * Path prefixes that require an authenticated session. Anything not
 * under one of these prefixes is treated as public (marketing pages,
 * legal pages, auth pages, 404/error boundaries, etc.).
 *
 * Kept separate from the SEO disallow list in `app/robots.ts` — that
 * list also hides `/auth/` from search engines, which should NOT
 * redirect anonymous visitors away (it's the OAuth callback route).
 */
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/jobs",
  "/contractors",
  "/floor-plans",
  "/forms-library",
  "/hoa",
  "/inventory",
  "/libraries",
  "/noa-library",
  "/settings",
  "/onboarding",
  "/sales",
  "/warehouse",
  "/install",
  "/service",
  "/measure",
  "/tools",
];
