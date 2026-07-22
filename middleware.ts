import { NextRequest, NextResponse } from "next/server";

/**
 * Guarantees every visitor has an anonymous brain identity — the seam that
 * lets "each user has their own wiki" work with zero accounts (SPEC-BRAIN.md
 * Sec3.1). A first-time visitor gets a fresh id; it's also forwarded via a
 * request header so THIS request's route handler can read it immediately,
 * without waiting for the Set-Cookie round-trip.
 */
export const BRAIN_COOKIE = "q4np-brain";
export const BRAIN_HEADER = "x-q4np-brain";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest) {
  const existing = request.cookies.get(BRAIN_COOKIE)?.value;
  const brainId = existing ?? crypto.randomUUID();

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(BRAIN_HEADER, brainId);

  const response = NextResponse.next({
    request: { headers: forwardedHeaders },
  });

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
    "/",
    "/generate",
    "/brain",
    "/api/artifact/:path*",
    "/api/brain/:path*",
  ],
};
