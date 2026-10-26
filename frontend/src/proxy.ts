import { type NextRequest, NextResponse } from "next/server";

// Visitors with a session cookie skip the landing page. The matcher runs this only when that cookie
// exists, so anonymous visits to / stay static. A stale cookie reaches /admin, which sends them to /login.
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/admin", request.url));
}

export const config = {
  // Must equal AUTH_COOKIE_NAME in server/auth-api.ts; matcher values are read at build time.
  matcher: [{ source: "/", has: [{ type: "cookie", key: "cafenme_session" }] }],
};
