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
};

export default nextConfig;
