import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";
import { PROTECTED_ROUTE_PREFIXES } from "@/lib/protected-route-prefixes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Protected app routes plus the OAuth callback path — none of
      // these should be indexed, even though /auth/ itself stays
      // reachable by anonymous visitors mid-login (see middleware.ts).
      disallow: [...PROTECTED_ROUTE_PREFIXES, "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
