// V1 (SPEC-VAULT §V1) — GET /api/brain/note/[id] wiring. Foundation topics and
// pillar indexes resolve with no brain content (no embedder needed); an unknown
// id is a 404.
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getNode } from "@/lib/content/tree";
import { BRAIN_HEADER } from "@/lib/brain/id";

const BRAIN = "44444444-4444-4444-4444-444444444444";

function noteReq(id: string): { req: NextRequest; params: Promise<{ id: string }> } {
  const h = new Headers();
  h.set(BRAIN_HEADER, BRAIN);
  const req = new NextRequest(`http://localhost/api/brain/note/${encodeURIComponent(id)}`, { headers: h });
  return { req, params: Promise.resolve({ id: encodeURIComponent(id) }) };
}

describe("GET /api/brain/note/[id]", () => {
  it("returns a curated topic page", async () => {
    const { GET } = await import("@/app/api/brain/note/[id]/route");
    const { req, params } = noteReq("3.2");
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const page = await res.json();
    expect(page.kind).toBe("topic");
    expect(page.title).toBe(getNode("3.2")!.title);
  });

  it("returns a pillar index page", async () => {
    const { GET } = await import("@/app/api/brain/note/[id]/route");
    const { req, params } = noteReq("pillar:tax");
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const page = await res.json();
    expect(page.kind).toBe("pillar");
    expect(page.markdown).toContain("[[");
  });

  it("404s an unknown id", async () => {
    const { GET } = await import("@/app/api/brain/note/[id]/route");
    const { req, params } = noteReq("no-such-node-xyz");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("404s a source id that isn't in the caller's brain", async () => {
    const { GET } = await import("@/app/api/brain/note/[id]/route");
    const { req, params } = noteReq("source:00000000-0000-0000-0000-000000000000");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });
});
