import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// The admin console already lives at /admin on this same app (same build,
// same auth) — this just lets the subdomain's root serve it directly instead
// of requiring the /admin path. Only the bare root is rewritten: /login,
// /auth/callback, and anything else on this hostname still need to resolve
// normally (that's exactly where requireUser()/requirePlatformAdmin() send
// an unauthenticated or non-admin visitor after this rewrite takes them to
// /admin — a blanket rewrite would send /login itself to a nonexistent
// /admin/login).
const ADMIN_HOSTNAME = "admin.permitaio.com";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  if (hostname === ADMIN_HOSTNAME && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return await updateSession(request, url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
