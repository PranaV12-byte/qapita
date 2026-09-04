import { describe, expect, it } from "vitest";
import { composeBatchAnswer, type AnswerPart } from "../lib/llm/batch-answer";
import { createEvidenceProfile, stripMarkdown } from "../lib/llm/answer-composer";
import type { RetrievalChunk } from "../lib/rag/types";

function chunk(topic: string, nodeId: string): RetrievalChunk {
  const parentText = [
    `${topic} is a reviewed equity compensation topic with a direct definition and clear operating mechanics.`,
    `The applicable timing and tax treatment for ${topic} depend on the award terms and the employee's actions.`,
  ].join("\n\n");
  return {
    tier: "curated",
    nodeId,
    title: topic,
    headingPath: `${topic} > Overview`,
    parentId: `${nodeId}#summary`,
    text: parentText,
    parentText,
    score: 100,
    cosine: 0.9,
    sectionKind: "summary",
  };
}

function supportedPart(query: string, topic: string, nodeId: string): AnswerPart {
  const intent = { kind: "definition" as const, nodeId, title: topic, topics: [topic] };
  const chunks = [chunk(topic, nodeId)];
  return {
    query,
    intent,
    chunks,
    profile: createEvidenceProfile(query, chunks, intent),
    citations: [{ kind: "topic", nodeId, title: topic }],
  };
}

describe("multi-question composition", () => {
  it("keeps independently grounded topics separate and merges their citations", () => {
    const result = composeBatchAnswer([
      supportedPart("What is an ISO?", "Incentive stock options", "1.1"),
      supportedPart("What is an RSU?", "RSUs & RSAs", "1.3"),
      supportedPart("What is liquidity?", "Liquidity & exits", "6.1"),
    ]);

    expect(result.answerAvailable).toBe(true);
    expect(result.bodyMarkdown).toContain("## Incentive stock options");
    expect(result.bodyMarkdown).toContain("## RSUs & RSAs");
    expect(result.bodyMarkdown).toContain("## Liquidity & exits");
    expect(result.citations.map((citation) => citation.nodeId)).toEqual(["1.1", "1.3", "6.1"]);
    expect(stripMarkdown(result.bodyMarkdown).split(/\s+/).length).toBeLessThanOrEqual(2500);
  });

  it("keeps a content-gap message inside an otherwise supported result", () => {
    const result = composeBatchAnswer([
      supportedPart("What is an ISO?", "Incentive stock options", "1.1"),
      { query: "What is a made-up award?", intent: { kind: "general" }, chunks: [], citations: [] },
    ]);

    expect(result.answerAvailable).toBe(true);
    expect(result.bodyMarkdown).toContain("does not have enough verified guidance to answer this part confidently yet");
  });
});
