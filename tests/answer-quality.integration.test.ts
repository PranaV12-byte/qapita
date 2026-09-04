import { describe, expect, it } from "vitest";
import { getNode } from "../lib/content/tree";
import { buildDefinitionRetrievalQuery, getQueryIntent } from "../lib/llm/query-intent";
import { selectAnswerGrounding } from "../lib/llm/grounding";
import {
  GRACEFUL_COMPARISON_BODY,
  GRACEFUL_OFF_TOPIC_BODY,
  GRACEFUL_UNKNOWN_BODY,
  MockLLM,
  gracefulComparisonRefinement,
  gracefulOffTopic,
  gracefulUnknown,
} from "../lib/llm/mock";
import { retrieveForBrain } from "../lib/brain/retrieval";
import { answerLengthPolicy, stripMarkdown } from "../lib/llm/answer-composer";

async function answerFor(query: string, format: "reference" | "comparison" = "reference") {
  const intent = getQueryIntent(query);
  const topic = intent.kind === "definition" ? getNode(intent.nodeId) : undefined;
  const retrievalQuery = topic ? buildDefinitionRetrievalQuery(query, topic) : query;
  const retrieval = await retrieveForBrain(retrievalQuery, null, {
    nodeId: topic?.id,
    topK: intent.kind === "comparison" || (intent.facets?.length ?? 0) >= 2 ? 16 : 12,
  });
  const grounding = selectAnswerGrounding(query, retrieval.chunks, {
    definitionNodeId: topic?.id,
    intent,
  });
  const result = grounding.answerable
    ? await new MockLLM().generate(query, grounding.chunks, { format, queryIntent: intent })
    : null;
  return { intent, grounding, result };
}

function plain(result: Awaited<ReturnType<typeof answerFor>>["result"]): string {
  return result ? stripMarkdown(result.bodyMarkdown).toLowerCase() : "";
}

function expectCleanGeneratedProse(value: string) {
  expect(value).not.toMatch(/[【】]|node\s*id|source\s*id/i);
  expect(value).not.toMatch(/NASPP|MyStockOptions|[\u2013\u2014]|:\./i);
  expect(value).not.toMatch(/<\/?[A-Za-z][^>]*>/);
  expect((value.match(/\*\*/g)?.length ?? 0) % 2).toBe(0);
}

describe("real Wiki answer quality", () => {
  it.each([
    "What is an ISO?",
    "How does a tender offer work for private company employees?",
    "Can exercising ISOs trigger AMT if the shares are not sold?",
    "What happens to unvested RSUs after termination?",
  ])("keeps the deterministic answer adaptive and block-separated for %s", async (query) => {
    const { intent, result } = await answerFor(query);
    expect(result).not.toBeNull();
    const body = result!.bodyMarkdown;
    const words = stripMarkdown(body).split(/\s+/).filter(Boolean).length;
    const headings = body.match(/^##\s+/gm)?.length ?? 0;
    const policy = answerLengthPolicy(intent, query);

    expect(words).toBeLessThanOrEqual(policy.maxWords);
    expect(headings).toBeLessThanOrEqual(policy.maxHeadings);
    expect(body).toContain("\n\n");
    expect(body.trim()).not.toMatch(/[,:;]$/);
  });

  it.each([
    "How does a tender offer work for private company employees?",
    "Can exercising ISOs trigger AMT if the shares are not sold?",
    "What happens to unvested RSUs after termination?",
  ])("uses the available Wiki depth for %s", async (query) => {
    const { result } = await answerFor(query);
    const words = stripMarkdown(result!.bodyMarkdown).split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThan(300);
  });

  it("answers a tender offer query with the requested process and tax coverage", async () => {
    const { grounding, result } = await answerFor("How does a tender offer work for private company employees?");
    const body = plain(result);

    expect(grounding.answerable).toBe(true);
    expect(result).not.toBeNull();
    expect(body).toContain("eligib");
    expect(body).toContain("price");
    expect(body).toContain("window");
    expect(body).toContain("election");
    expect(body).toContain("settlement");
    expect(body).toContain("tax");
    expect(body).not.toMatch(/s-8|espp|rule 144|409a/i);
    expectCleanGeneratedProse(result!.bodyMarkdown);
  });

  it("keeps both ISO and NSO evidence for a non-table comparison question", async () => {
    const { grounding, result } = await answerFor("What is the difference between ISOs and NSOs?");
    const nodes = grounding.chunks.map((chunk) => chunk.nodeId);
    const body = plain(result);

    expect(grounding.answerable).toBe(true);
    expect(nodes).toContain("1.1");
    expect(nodes).toContain("1.2");
    expect(body).toContain("iso");
    expect(body).toContain("nso");
    expectCleanGeneratedProse(result!.bodyMarkdown);
  });

  it("builds a structured comparison from real Wiki evidence", async () => {
    const { grounding, result } = await answerFor("Compare ISOs, NSOs, and RSUs.", "comparison");

    expect(grounding.answerable).toBe(true);
    expect(result?.comparison?.columns).toHaveLength(3);
    expect(result?.comparison?.rows.length).toBeGreaterThan(0);
    expect(result?.comparison?.rows.every((row) => row.values.length === 3)).toBe(true);
    expect(result?.bodyMarkdown).not.toContain("|");
    expectCleanGeneratedProse(result!.bodyMarkdown);
  });

  it.each([
    ["What is an ISO?", "employee stock option"],
    ["Can exercising ISOs trigger AMT if the shares are not sold?", "amt"],
    ["How are NSOs taxed when exercised and later sold?", "ordinary income"],
    ["What happens if an 83(b) election is filed late?", "30-day"],
    ["Why do private companies use double-trigger RSUs?", "double-trigger"],
  ])("keeps a focused answer for %s", async (query, expectedTerm) => {
    const { grounding, result } = await answerFor(query);
    expect(grounding.answerable).toBe(true);
    expect(result).not.toBeNull();
    expect(plain(result)).toContain(expectedTerm);
    expectCleanGeneratedProse(result!.bodyMarkdown);
  });

  it("does not collapse a scenario answer to a sentence fragment", async () => {
    const { grounding, result } = await answerFor("What happens to unvested RSUs after termination?");
    const body = plain(result);

    expect(grounding.answerable).toBe(true);
    expect(body).toContain("unvested");
    expect(body).toContain("rsu");
    expect(body).toContain("termination");
    expect(body.split(/\s+/).length).toBeGreaterThan(40);
    expectCleanGeneratedProse(result!.bodyMarkdown);
  });

  it("returns no answer for clearly off-topic and uncovered questions", async () => {
    const offTopic = await answerFor("What is the weather in Mumbai today?");
    const uncovered = await answerFor("How do I repair a bicycle chain?");

    expect(offTopic.grounding.answerable).toBe(false);
    expect(uncovered.grounding.answerable).toBe(false);
  });

  it("uses distinct graceful copy for content gaps, scope gaps, and comparisons", () => {
    expect(gracefulUnknown("What is a bicycle chain?").bodyMarkdown).toBe(GRACEFUL_UNKNOWN_BODY);
    expect(gracefulOffTopic("What is a bicycle chain?").bodyMarkdown).toBe(GRACEFUL_OFF_TOPIC_BODY);
    expect(gracefulComparisonRefinement("Compare ISOs and bananas.").bodyMarkdown).toBe(GRACEFUL_COMPARISON_BODY);
    expect(GRACEFUL_UNKNOWN_BODY).not.toContain("Reference Guide");
  });
});
