import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie-names";

/**
 * Defence-in-depth target for authenticated pages that observe a present
 * session cookie which the API has nonetheless rejected. Server components
 * cannot mutate cookies; this Route Handler can, so pages redirect here
 * to drop the stale cookie and bounce the user back to `/auth/sign-in`.
 *
 * Uses a 307 with a *relative* `Location` to bypass `NextResponse.redirect`,
 * which in dev mode rewrites the origin to `localhost` based on the bind
 * address rather than the request's actual `Host` header (breaks tests
 * behind a docker-network hostname).
 */
export function GET(): NextResponse {
  const response = new NextResponse(null, { status: 307 });
  response.headers.set("Location", "/auth/sign-in");
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
