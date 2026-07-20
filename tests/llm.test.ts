import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import type { RetrievalChunk } from "@/lib/rag/types";

const makeChunk = (
  text: string,
  nodeId: string,
  tier: "curated" | "scrape" = "curated"
): RetrievalChunk => ({
  tier,
  nodeId,
  text,
  score: 0.9,
  cosine: 0.9,
  isScenario: false,
  headingPath: "",
});

beforeAll(() => {
  process.env.MOCK_DELAY = "false";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MockLLM", () => {
  it("produces valid ArtifactResult from chunks", async () => {
    const { MockLLM } = await import("@/lib/llm/mock");
    const mock = new MockLLM();
    const chunks: RetrievalChunk[] = [
      makeChunk(
        "RSUs vest at ordinary income rates. The FMV at vest is taxable income reported on the W-2.",
        "1.3"
      ),
      makeChunk(
        "Section 3402 requires employers to withhold at supplemental rates. This applies to all RSU vesting events.",
        "3.4"
      ),
      makeChunk(
        "Capital gains apply after the holding period ends. Long-term rates apply if held over one year.",
        "3.3"
      ),
    ];
    const result = await mock.generate("How are RSUs taxed?", chunks);
    expect(result.title).toMatch(/^Reference:/);
    expect(result.bodyMarkdown).toContain("What this covers");
    expect(result.bodyMarkdown).toContain("Key points");
    expect(result.citations).toBeInstanceOf(Array);
    expect(result.citations.length).toBeGreaterThan(0);
    result.citations.forEach((c) => {
      expect(c).toHaveProperty("nodeId");
      expect(c).toHaveProperty("title");
    });
    expect(typeof result.quickShare).toBe("string");
    expect(result.quickShare.length).toBeGreaterThan(0);
  });

  it("bodyMarkdown contains text from provided chunks", async () => {
    const { MockLLM } = await import("@/lib/llm/mock");
    const mock = new MockLLM();
    const chunks: RetrievalChunk[] = [
      makeChunk(
        "RSUs vest at ordinary income rates. The FMV at vest is taxable.",
        "1.3"
      ),
    ];
    const result = await mock.generate("RSU tax", chunks);
    expect(result.bodyMarkdown).toContain("RSUs vest at ordinary income");
  });

  it("quickShare contains no markdown formatting", async () => {
    const { MockLLM } = await import("@/lib/llm/mock");
    const mock = new MockLLM();
    const chunks: RetrievalChunk[] = [
      makeChunk(
        "**RSU** vesting triggers ordinary income. The employer must withhold.",
        "1.3"
      ),
    ];
    const result = await mock.generate("RSU tax", chunks);
    expect(result.quickShare).not.toContain("##");
    expect(result.quickShare).not.toContain("**");
  });

  it("citations nodeIds come from input chunks", async () => {
    const { MockLLM } = await import("@/lib/llm/mock");
    const mock = new MockLLM();
    const chunks: RetrievalChunk[] = [
      makeChunk("RSUs are taxed as ordinary income at vesting. IRC Section 83 governs.", "1.3"),
      makeChunk("Curated content about withholding. Employers withhold at supplemental rates.", "3.4"),
    ];
    const result = await mock.generate("RSU withholding", chunks);
    const inputNodeIds = new Set(["1.3", "3.4"]);
    result.citations.forEach((c) => {
      expect(inputNodeIds.has(c.nodeId)).toBe(true);
    });
  });

  it("excludes scrape-tier text from output", async () => {
    const { MockLLM } = await import("@/lib/llm/mock");
    const mock = new MockLLM();
    const chunks: RetrievalChunk[] = [
      makeChunk(
        "RSUs are taxed as ordinary income at vesting. This is governed by IRC 83.",
        "1.3"
      ),
      makeChunk(
        "Curated content about withholding. Employers withhold at supplemental rates.",
        "3.4"
      ),
      makeChunk(
        "SCRAPE_SENTINEL_XYZ: scrape chunk text that should not appear.",
        "1.3",
        "scrape"
      ),
      makeChunk(
        "Another SCRAPE_SENTINEL_XYZ scrape tier chunk.",
        "3.2",
        "scrape"
      ),
    ];
    const result = await mock.generate("RSU withholding", chunks);
    expect(result.bodyMarkdown).not.toContain("SCRAPE_SENTINEL_XYZ");
    expect(result.quickShare).not.toContain("SCRAPE_SENTINEL_XYZ");
  });

  it("deduplicates citations", async () => {
    const { MockLLM } = await import("@/lib/llm/mock");
    const mock = new MockLLM();
    const chunks: RetrievalChunk[] = [
      makeChunk("RSU text A. First sentence here.", "1.3"),
      makeChunk("RSU text B. Second sentence here.", "1.3"),
      makeChunk("Tax text A. First sentence.", "3.2"),
      makeChunk("Tax text B. Second sentence.", "3.2"),
    ];
    const result = await mock.generate("RSU tax", chunks);
    expect(result.citations.length).toBe(2);
    const nodeIds = result.citations.map((c) => c.nodeId);
    expect(nodeIds).toContain("1.3");
    expect(nodeIds).toContain("3.2");
  });

  it("handles empty chunks gracefully", async () => {
    const { MockLLM } = await import("@/lib/llm/mock");
    const mock = new MockLLM();
    await expect(mock.generate("Any query", [])).resolves.not.toThrow();
    const result = await mock.generate("Any query", []);
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("bodyMarkdown");
    expect(result).toHaveProperty("citations");
    expect(result).toHaveProperty("quickShare");
    expect(Array.isArray(result.citations)).toBe(true);
  });
});

describe("Provider selection", () => {
  it("LLM_PROVIDER=mock returns provider with generate function", async () => {
    process.env.LLM_PROVIDER = "mock";
    const { getLLMProvider } = await import("@/lib/llm/provider");
    const provider = getLLMProvider();
    expect(typeof provider.generate).toBe("function");
  });

  it("LLM_PROVIDER=groq without GROQ_API_KEY falls back to mock (no crash)", async () => {
    process.env.LLM_PROVIDER = "groq";
    delete process.env.GROQ_API_KEY;
    const { getLLMProvider } = await import("@/lib/llm/provider");
    const provider = getLLMProvider();
    const chunks: RetrievalChunk[] = [
      makeChunk(
        "RSUs vest and are taxed as ordinary income. IRC Section 83 governs.",
        "1.3"
      ),
    ];
    const result = await provider.generate("RSU tax", chunks);
    expect(result.title).toBeDefined();
    expect(typeof result.bodyMarkdown).toBe("string");
  });

  it("LLM_PROVIDER=anthropic falls back to mock (no crash)", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    const { getLLMProvider } = await import("@/lib/llm/provider");
    const provider = getLLMProvider();
    const chunks: RetrievalChunk[] = [
      makeChunk("ISOs have favorable tax treatment. AMT applies.", "1.1"),
    ];
    await expect(provider.generate("ISO tax", chunks)).resolves.not.toThrow();
  });

  it("LLM_PROVIDER=undefined defaults to mock (no crash)", async () => {
    delete process.env.LLM_PROVIDER;
    const { getLLMProvider } = await import("@/lib/llm/provider");
    const provider = getLLMProvider();
    expect(typeof provider.generate).toBe("function");
    const chunks: RetrievalChunk[] = [
      makeChunk("NSO exercise creates ordinary income. W-2 reporting required.", "1.2"),
    ];
    await expect(provider.generate("NSO", chunks)).resolves.not.toThrow();
  });
});

describe("Groq provider fallback", () => {
  it("falls back to mock when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;
    const { GroqProvider } = await import("@/lib/llm/groq");
    const provider = new GroqProvider();
    const chunks: RetrievalChunk[] = [
      makeChunk("ISOs are incentive stock options. Exercise below FMV avoids NSO treatment.", "1.1"),
    ];
    const result = await provider.generate("ISO", chunks);
    expect(result.title).toBeDefined();
    expect(result.bodyMarkdown).toBeDefined();
  });

  it("falls back to mock when fetch rejects", async () => {
    process.env.GROQ_API_KEY = "fake-key-for-test";
    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw new Error("network error");
    };
    try {
      const { GroqProvider } = await import("@/lib/llm/groq");
      const provider = new GroqProvider();
      const chunks: RetrievalChunk[] = [
        makeChunk(
          "NSO exercise creates ordinary income. W-2 reporting required.",
          "1.2"
        ),
      ];
      const result = await provider.generate("NSO", chunks);
      expect(result.title).toBeDefined();
    } finally {
      global.fetch = originalFetch;
      delete process.env.GROQ_API_KEY;
    }
  });
});
