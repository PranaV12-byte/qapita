import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

beforeAll(() => {
  process.env.MOCK_DELAY = "false";
  process.env.LLM_PROVIDER = "mock";
  // Contract tests — exercise hybrid retrieval without the cross-encoder download.
  process.env.RERANK_ENABLED = "false";
});

function makeReq(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe(
  "POST /api/artifact",
  () => {
    it("returns 200 and valid shape for a free-text query", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq("/api/artifact", { query: "How are RSUs taxed?" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(typeof data.artifactId).toBe("string");
      expect(typeof data.title).toBe("string");
      expect(typeof data.bodyMarkdown).toBe("string");
      expect(typeof data.quickShare).toBe("string");
      expect(Array.isArray(data.citations)).toBe(true);
      expect(data.status).toBe("generated");
      expect(typeof data.fallbackUsed).toBe("boolean");
      expect(typeof data.logged).toBe("boolean");
      expect((data.bodyMarkdown as string).length).toBeGreaterThan(0);
    });

    it("bodyMarkdown contains RSU-related content", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq("/api/artifact", { query: "How are RSUs taxed?" });
      const res = await POST(req);
      const data = await res.json() as Record<string, unknown>;
      const body = data.bodyMarkdown as string;
      const hasRelevant =
        body.toLowerCase().includes("rsu") ||
        body.toLowerCase().includes("restricted stock") ||
        body.toLowerCase().includes("vest");
      expect(hasRelevant).toBe(true);
    });

    it("citations array is non-empty with nodeId and title", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq("/api/artifact", { query: "How are RSUs taxed?" });
      const res = await POST(req);
      const data = await res.json() as Record<string, unknown>;
      const citations = data.citations as Array<{ nodeId: string; title: string }>;
      expect(citations.length).toBeGreaterThan(0);
      citations.forEach((c) => {
        expect(typeof c.nodeId).toBe("string");
        expect(typeof c.title).toBe("string");
      });
    });

    it("returns 200 with scenario field when scenarioId is provided", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq("/api/artifact", { scenarioId: "rsu-vesting-tax" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.scenario).not.toBeNull();
      const scenario = data.scenario as { id: string; label: string };
      expect(scenario.id).toBe("rsu-vesting-tax");
      expect(typeof scenario.label).toBe("string");
    });

    it("scenarioId response citations reference scenario nodeIds", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq("/api/artifact", { scenarioId: "rsu-vesting-tax" });
      const res = await POST(req);
      const data = await res.json() as Record<string, unknown>;
      const citations = data.citations as Array<{ nodeId: string }>;
      const scenarioNodes = new Set(["1.3", "3.2", "3.4"]);
      const hasOverlap = citations.some((c) => scenarioNodes.has(c.nodeId));
      expect(hasOverlap).toBe(true);
    });

    it("returns 200 with nodeId boost", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq("/api/artifact", {
        query: "vesting schedule",
        nodeId: "2.2",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      const citations = data.citations as Array<{ nodeId: string }>;
      const hasBoosted = citations.some((c) => c.nodeId === "2.2");
      expect(hasBoosted).toBe(true);
    });

    it("returns 400 for empty body", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const req = makeReq("/api/artifact", {});
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json() as Record<string, unknown>;
      expect(data.error).toBe("empty_query");
    });

    it("logging: artifact-log.jsonl grows after successful call", async () => {
      const { POST } = await import("@/app/api/artifact/route");
      const logPath = path.join(process.cwd(), "data", "artifact-log.jsonl");
      const sizeBefore = fs.existsSync(logPath)
        ? fs.statSync(logPath).size
        : 0;

      const req = makeReq("/api/artifact", { query: "vesting basics" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;

      if (data.logged === true) {
        expect(fs.existsSync(logPath)).toBe(true);
        expect(fs.statSync(logPath).size).toBeGreaterThan(sizeBefore);
        const lines = fs
          .readFileSync(logPath, "utf-8")
          .trim()
          .split("\n")
          .filter(Boolean);
        const lastLine = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
        expect(lastLine).toHaveProperty("ts");
        expect(lastLine).toHaveProperty("mode");
        expect(lastLine).toHaveProperty("query");
        expect(lastLine).toHaveProperty("fallbackUsed");
      }
    });
  },
  { timeout: 120_000 }
);

describe("POST /api/artifact/deliver", () => {
  it("returns 200 with ok:true for valid email", async () => {
    const { POST } = await import("@/app/api/artifact/deliver/route");
    const req = makeReq("/api/artifact/deliver", {
      artifactId: "test-123",
      channel: "email",
      email: "test@example.com",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(typeof data.logged).toBe("boolean");
  });

  it("returns 400 for invalid email", async () => {
    const { POST } = await import("@/app/api/artifact/deliver/route");
    const req = makeReq("/api/artifact/deliver", {
      artifactId: "test-123",
      channel: "email",
      email: "not-an-email",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/artifact/pdf", () => {
  it("returns 200 application/pdf with non-empty body", async () => {
    const { POST } = await import("@/app/api/artifact/pdf/route");
    const req = makeReq("/api/artifact/pdf", {
      title: "RSU Tax Guide",
      bodyMarkdown:
        "## Key points\n1. RSUs taxed as ordinary income at vesting.\n2. Employer withholds at supplemental rates.",
      citations: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });
});
