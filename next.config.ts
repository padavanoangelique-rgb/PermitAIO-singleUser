import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      // County permit-application PDFs are routinely 1–5 MB, and base64
      // encoding adds ~33% overhead. The Next.js default 1 MB body limit
      // silently drops uploads at that size — the client just sits on
      // "Uploading…" until it gives up. Raise to 10 MB to cover all
      // county form PDFs and NOA packages users upload through the app.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
