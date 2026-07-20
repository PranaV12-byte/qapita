import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as artifactPOST } from "@/app/api/artifact/route";
import { POST as pdfPOST } from "@/app/api/artifact/pdf/route";
import { POST as deliverPOST } from "@/app/api/artifact/deliver/route";
import path from "node:path";
import os from "node:os";

const SCRAPE_PATTERNS = [/\bwww\./i, /\bhttp[s]?:\/\//i];

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/artifact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.MOCK_DELAY = "false";
  process.env.LLM_PROVIDER = "mock";
  process.env.RERANK_ENABLED = "false";
  process.env.ARTIFACT_LOG_PATH = path.join(
    os.tmpdir(),
    `e2e-test-${Date.now()}.jsonl`
  );
});

describe(
  "e2e: full RAG pipeline",
  () => {
    it(
      "POST /api/artifact with query returns ArtifactResult shape",
      async () => {
        const req = makeReq({ query: "How are RSUs taxed at vest?" });
        const res = await artifactPOST(req);
        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data).toMatchObject({
          artifactId: expect.any(String),
          title: expect.any(String),
          bodyMarkdown: expect.any(String),
          quickShare: expect.any(String),
          status: "generated",
          fallbackUsed: expect.any(Boolean),
        });
        expect(Array.isArray(data.citations)).toBe(true);
      },
      120_000
    );

    it(
      "bodyMarkdown contains ## headers",
      async () => {
        const req = makeReq({ query: "What happens to ISOs when you leave a company?" });
        const res = await artifactPOST(req);
        const data = await res.json();
        expect(data.bodyMarkdown).toMatch(/^##\s/m);
      },
      120_000
    );

    it(
      "quickShare has no ## or ** markdown",
      async () => {
        const req = makeReq({ query: "Explain the 83(b) election" });
        const res = await artifactPOST(req);
        const data = await res.json();
        expect(data.quickShare).not.toContain("##");
        expect(data.quickShare).not.toContain("**");
      },
      120_000
    );
  }
);

describe(
  "e2e: scenario pipeline",
  () => {
    it(
      "POST /api/artifact with scenarioId returns result with scenario field",
      async () => {
        const req = makeReq({ scenarioId: "s-rsu-tax-withholding" });
        const res = await artifactPOST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("generated");
        // scenario or fallbackScenario should be set
        const hasScenario = data.scenario || data.fallbackScenario;
        expect(hasScenario).toBeTruthy();
      },
      120_000
    );
  }
);

describe(
  "e2e: fallback",
  () => {
    it(
      "very obscure query triggers fallback or still returns a result",
      async () => {
        const req = makeReq({
          query:
            "xyzzy frobnicator quantum equity nonsense 99999 zzz",
        });
        const res = await artifactPOST(req);
        // Either 200 with fallback or 200 without — API must respond 200
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("generated");
      },
      120_000
    );
  }
);

describe(
  "e2e: nodeId boost",
  () => {
    it(
      "POST /api/artifact with nodeId returns artifact",
      async () => {
        const req = makeReq({
          query: "What are the tax implications?",
          nodeId: "rsu-tax",
        });
        const res = await artifactPOST(req);
        // 200 (nodeId boost applied if node exists, or ignored if not)
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("artifactId");
      },
      120_000
    );
  }
);

describe(
  "e2e: PDF",
  () => {
    it(
      "POST /api/artifact/pdf returns application/pdf with %PDF magic bytes",
      async () => {
        const req = new NextRequest("http://localhost/api/artifact/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "RSU Vesting Tax Primer",
            bodyMarkdown:
              "## Key points\n1. RSUs vest as ordinary income.\n2. Withholding at vest.\n3. Cost basis = FMV at vest.",
            citations: [],
          }),
        });
        const res = await pdfPOST(req);
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("application/pdf");

        const arrayBuf = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        // %PDF magic bytes: 0x25 0x50 0x44 0x46
        expect(bytes[0]).toBe(0x25);
        expect(bytes[1]).toBe(0x50);
        expect(bytes[2]).toBe(0x44);
        expect(bytes[3]).toBe(0x46);
      },
      120_000
    );
  }
);

describe(
  "e2e: deliver",
  () => {
    it(
      "POST /api/artifact/deliver with valid email returns ok:true",
      async () => {
        const req = new NextRequest("http://localhost/api/artifact/deliver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifactId: "test-id-123",
            channel: "email",
            email: "test@example.com",
          }),
        });
        const res = await deliverPOST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
      },
      120_000
    );
  }
);

describe(
  "e2e: no scrape text verbatim",
  () => {
    it(
      "bodyMarkdown does not contain raw URLs",
      async () => {
        const req = makeReq({ query: "What is an NSO stock option?" });
        const res = await artifactPOST(req);
        const data = await res.json();
        for (const pattern of SCRAPE_PATTERNS) {
          expect(data.bodyMarkdown).not.toMatch(pattern);
        }
      },
      120_000
    );
  }
);
