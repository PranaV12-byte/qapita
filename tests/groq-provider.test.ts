import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GroqProvider } from "../lib/llm/groq";
import type { RetrievalChunk } from "../lib/rag/types";

const scrapeChunk: RetrievalChunk = {
  tier: "scrape",
  source: "NASPP",
  nodeId: "1.1",
  text: "Stock options give an employee the right to buy shares under a plan.",
  score: 1,
  cosine: 1,
};

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
      response_format: { type: string; json_schema: { strict: boolean; schema: { additionalProperties: boolean } } };
    };
    expect(payload.model).toBe("openai/gpt-oss-20b");
    expect(payload.response_format.type).toBe("json_schema");
    expect(payload.response_format.json_schema.strict).toBe(true);
    expect(payload.response_format.json_schema.schema.additionalProperties).toBe(false);
  });

  it("falls back after one failed provider call", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GroqProvider().generate("What is an option?", [scrapeChunk]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.bodyMarkdown).toContain("knowledge base");
  });
});
