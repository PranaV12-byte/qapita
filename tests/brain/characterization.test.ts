// Characterization baseline — pins today's POST /api/artifact behavior (shape +
// mock output) for two fixed queries with an empty brain, BEFORE any Second
// Brain wiring touches this route. Every later phase must keep these green:
// empty-brain behavior must stay byte-equivalent to this snapshot. Never edit
// this file to make a later phase pass — a legitimate empty-brain behavior
// change is a new characterization, not a fix to this one (SPEC-BRAIN.md Sec4.6).
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.MOCK_DELAY = "false";
  process.env.LLM_PROVIDER = "mock";
  process.env.RERANK_ENABLED = "false";
});

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/artifact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe(
  "characterization: POST /api/artifact (pre-Second-Brain baseline)",
  () => {
    it("pins shape + mock output for a free-text query", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq({ query: "How are RSUs taxed?" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchSnapshot({ artifactId: expect.any(String) });
    });

    it("pins shape + mock output for the rsu-vesting-tax scenario", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq({ scenarioId: "rsu-vesting-tax" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchSnapshot({ artifactId: expect.any(String) });
    });
  },
  { timeout: 120_000 }
);
