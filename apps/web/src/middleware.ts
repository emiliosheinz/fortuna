import { type NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/lib/auth/env";

/**
 * Browser-bound `/api/v1/*` requests are forwarded to the backend at
 * `API_BASE_URL` with the `/api/v1` prefix stripped. The namespace keeps
 * proxied paths separated from local Next.js route handlers under
 * `/api/...`, so backend endpoints can never collide with a sibling
 * `route.ts`. Reads `API_BASE_URL` per request, so the built image is
 * portable across environments.
 */
export function middleware(req: NextRequest): NextResponse {
  const apiBaseUrl = requireEnv("API_BASE_URL").replace(/\/$/, "");
  const upstreamPath = req.nextUrl.pathname.replace(/^\/api\/v1/, "");
  const target = new URL(
    `${upstreamPath}${req.nextUrl.search}`,
    `${apiBaseUrl}/`,
  );
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: "/api/v1/:path*",
};
