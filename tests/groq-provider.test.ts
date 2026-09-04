import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GroqProvider } from "../lib/llm/groq";
import type { RetrievalChunk } from "../lib/rag/types";
import { getQueryIntent } from "../lib/llm/query-intent";
import { GRACEFUL_UNKNOWN_BODY } from "../lib/llm/mock";

const scrapeChunk: RetrievalChunk = {
  tier: "scrape",
  source: "NASPP",
  nodeId: "1.1",
  text: "Stock options give an employee the right to buy shares under a plan.",
  score: 1,
  cosine: 1,
};

const comparisonChunks: RetrievalChunk[] = [
  {
    tier: "curated",
    nodeId: "1.1",
    title: "Incentive stock options",
    text: "ISOs can receive special tax treatment when statutory holding requirements are met.",
    parentText: "ISOs can receive special tax treatment when statutory holding requirements are met. The exercise spread can create an AMT preference item.",
    parentId: "1.1:parent",
    score: 1,
    cosine: 0.9,
  },
  {
    tier: "curated",
    nodeId: "1.2",
    title: "Non-qualified stock options",
    text: "NSOs are generally taxed on the exercise spread as ordinary income.",
    parentText: "NSOs are generally taxed on the exercise spread as ordinary income. The employer usually reports the spread through payroll.",
    parentId: "1.2:parent",
    score: 1,
    cosine: 0.89,
  },
];

describe("Groq provider reliability contract", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("MOCK_DELAY", "false");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("requests strict JSON Schema output in one provider call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        title: "Answer",
        bodyMarkdown: "## Answer\n\nOptions can provide a right to buy shares.",
        citations: [{ nodeId: "1.1", sourceId: null, title: "ignored" }],
        quickShare: "Options can provide a right to buy shares.",
      }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await new GroqProvider().generate("What is an option?", [scrapeChunk]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
      max_tokens: number;
      response_format: { type: string; json_schema: { strict: boolean; schema: { additionalProperties: boolean } } };
    };
    expect(payload.model).toBe("openai/gpt-oss-20b");
    expect(payload.max_tokens).toBe(12000);
    expect(payload.response_format.type).toBe("json_schema");
    expect(payload.response_format.json_schema.strict).toBe(true);
    expect(payload.response_format.json_schema.schema.additionalProperties).toBe(false);
  });

  it("falls back after one failed provider call", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GroqProvider().generate("What is an option?", [scrapeChunk]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.bodyMarkdown).toBe(GRACEFUL_UNKNOWN_BODY);
  });

  it("keeps definition grounding when Groq falls back to Mock", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetchMock);
    const query = "What is an ISO?";
    const intent = getQueryIntent(query);
    const result = await new GroqProvider().generate(query, [
      {
        tier: "curated",
        nodeId: "1.1",
        title: "Incentive stock options (ISOs)",
        headingPath: "Overview",
        parentId: "article:1.1#summary",
        sectionKind: "summary",
        text: "Incentive stock options (ISOs) are a type of employee stock option that can qualify for favorable tax treatment.",
        parentText: "Incentive stock options (ISOs) are a type of employee stock option that can qualify for favorable tax treatment.",
        score: 1,
        cosine: 0.9,
      },
    ], { queryIntent: intent });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.title).toBe("Incentive stock options (ISOs)");
    expect(result.bodyMarkdown).toContain("a type of employee stock option");
  });

  it("uses the comparison schema and returns deterministic table prose", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        title: "Ignored title",
        bodyMarkdown: "Ignored body",
        citations: [{ nodeId: "1.1", sourceId: null, title: "ignored" }, { nodeId: "1.2", sourceId: null, title: "ignored" }],
        quickShare: "Ignored share",
        comparison: {
          title: "ISOs vs NSOs:.",
          subtitle: "A concise comparison.",
          columns: ["ISOs", "NSOs"],
          rows: [{ feature: "Tax treatment", values: ["Special treatment may apply.", "Ordinary income generally applies."] }],
          takeaway: "The award terms and timing matter.",
        },
      }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GroqProvider().generate("What is the difference between ISOs and NSOs?", comparisonChunks, { format: "comparison" });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      max_tokens: number;
      response_format: { json_schema: { schema: { properties: { comparison?: unknown } } } };
    };

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload.max_tokens).toBe(3500);
    expect(payload.response_format.json_schema.schema.properties.comparison).toBeDefined();
    expect(result.comparison?.columns).toEqual(["ISOs", "NSOs"]);
    expect(result.bodyMarkdown).not.toContain("|");
    expect(result.bodyMarkdown).not.toContain(":.");
  });
});
