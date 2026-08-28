import { NextRequest, NextResponse } from "next/server";
import { auth0, isAuth0Configured } from "./lib/auth0";
import { BRAIN_COOKIE, BRAIN_HEADER, isValidBrainId } from "./lib/brain/id";

/**
 * Gives every visitor a private anonymous Brain identity, even before sign-in.
 * A new value is forwarded on the same request as well as set in a cookie, so
 * route handlers can safely use it without waiting for a second page load.
 */
export { BRAIN_COOKIE, BRAIN_HEADER };
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function middleware(request: NextRequest) {
  // Validate before trusting: a malformed/tampered cookie value must never
  // reach a route handler that uses it as a filesystem path component.
  const raw = request.cookies.get(BRAIN_COOKIE)?.value;
  const existing = raw && isValidBrainId(raw) ? raw : undefined;
  const brainId = existing ?? crypto.randomUUID();

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(BRAIN_HEADER, brainId);

  const authResponse = isAuth0Configured && auth0
    ? await auth0.middleware(request)
    : null;
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth/");

  // Auth0 owns all /auth/* redirects and callbacks. Its response must stay
  // intact, but the anonymous Brain identity still needs to survive the flow.
  if (authResponse && (isAuthRoute || authResponse.headers.has("location"))) {
    if (!existing) {
      authResponse.cookies.set(BRAIN_COOKIE, brainId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: ONE_YEAR_SECONDS,
        path: "/",
      });
    }
    return authResponse;
  }

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });

  // Keep Auth0's rolling-session cookies on ordinary application requests.
  for (const cookie of authResponse?.cookies.getAll() ?? []) {
    response.cookies.set(cookie);
  }

  if (!existing) {
    response.cookies.set(BRAIN_COOKIE, brainId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
