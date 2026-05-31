import path from "node:path";
import type { NextConfig } from "next";

// pnpm monorepo: pin Turbopack's workspace root to the repo root.
// Without this, Turbopack walks up from the current source file when a
// new route is added under /src/app/.../page.tsx and can land on a
// directory where `next/package.json` is not resolvable — which kills
// the dev server with "We couldn't find the Next.js package".
const monorepoRoot = path.resolve(__dirname, "..", "..");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["web"],
  turbopack: {
    root: monorepoRoot,
  },
  /**
   * Browser-bound `/api/:path*` requests are transparently forwarded to
   * `apps/api`. File-system route handlers under `apps/web/src/app/api/`
   * (the OAuth flow + clear-session) take precedence — they're matched
   * before this rewrite applies. Everything else under `/api/*` reaches
   * the backend with the session cookie forwarded automatically, so
   * adding a new backend endpoint needs no web-side glue.
   */
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl) {
      throw new Error("Environment variable API_BASE_URL must be set");
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
