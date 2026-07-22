import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware, BRAIN_COOKIE, BRAIN_HEADER } from "@/middleware";

function makeReq(url: string, existingCookie?: string): NextRequest {
  const headers = new Headers();
  if (existingCookie) headers.set("cookie", `${BRAIN_COOKIE}=${existingCookie}`);
  return new NextRequest(`http://localhost${url}`, { headers });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("middleware: anonymous brain identity", () => {
  it("sets a fresh, valid-UUID q4np-brain cookie for a first-time visitor", () => {
    const res = middleware(makeReq("/"));
    const cookie = res.cookies.get(BRAIN_COOKIE);
    expect(cookie?.value).toMatch(UUID_RE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    // ~1 year (allow slack for the age of the number itself).
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 365);
  });

  it("does not re-issue a cookie when one already exists", () => {
    const existing = "11111111-2222-3333-4444-555555555555";
    const res = middleware(makeReq("/generate", existing));
    expect(res.cookies.get(BRAIN_COOKIE)).toBeUndefined();
  });

  it("forwards the brain id to the same-request handler via a request header", () => {
    const existing = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const res = middleware(makeReq("/brain", existing));
    expect(res.headers.get(`x-middleware-request-${BRAIN_HEADER}`)).toBe(existing);
  });

  it("does not redirect or rewrite — passes the request through", () => {
    const res = middleware(makeReq("/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("replaces a malformed/tampered cookie value rather than trusting it", () => {
    // A cookie value must never reach a route handler unvalidated — it
    // becomes a filesystem path component (lib/brain/store.ts).
    const res = middleware(makeReq("/", "../../etc/passwd"));
    const cookie = res.cookies.get(BRAIN_COOKIE);
    expect(cookie?.value).toMatch(UUID_RE);
    expect(cookie?.value).not.toBe("../../etc/passwd");
    const forwarded = res.headers.get(`x-middleware-request-${BRAIN_HEADER}`);
    expect(forwarded).toMatch(UUID_RE);
  });
});
