import { describe, expect, it } from "vitest";
import { answerLengthPolicy, composeWikiAnswer, createEvidenceProfile, isWithinAnswerLengthPolicy, stripMarkdown } from "../lib/llm/answer-composer";
import type { QueryIntent } from "../lib/llm/query-intent";
import type { RetrievalChunk } from "../lib/rag/types";

function paragraph(section: number, paragraphIndex: number): string {
  return [
    `Section ${section} paragraph ${paragraphIndex} explains the technical rule and the conditions that determine when it applies.`,
    "It describes the relevant timing, identifies the practical consequence, and states the limitation that prevents the rule from being applied too broadly.",
    "The treatment depends on the award terms and the supported facts, so the analysis remains tied to the reviewed guidance.",
  ].join(" ");
}

function richChunk(index: number): RetrievalChunk {
  return {
    tier: "curated",
    nodeId: `1.${index + 1}`,
    title: "Technical equity guidance",
    headingPath: `Technical equity guidance > Section ${index + 1}`,
    parentId: `article:1.${index + 1}#${index + 1}`,
    text: paragraph(index + 1, 1),
    parentText: [1, 2, 3, 4].map((item) => paragraph(index + 1, item)).join("\n\n"),
    score: 100 - index,
    cosine: 0.9,
  };
}

describe("adaptive deterministic answer depth", () => {
  it("allows a richly grounded multi-part answer to grow without exceeding 1,500 words", () => {
    const query = "How do grant, vesting, exercise, tax, withholding, reporting, settlement, and sale work together?";
    const intent: QueryIntent = {
      kind: "general",
      facets: ["process", "tax", "lifecycle", "timing", "withholding", "reporting", "settlement"],
    };
    const answer = composeWikiAnswer(query, Array.from({ length: 8 }, (_, index) => richChunk(index)), intent);
    const words = stripMarkdown(answer!.bodyMarkdown).split(/\s+/).filter(Boolean).length;

    expect(answer).not.toBeNull();
    expect(words).toBeGreaterThanOrEqual(900);
    expect(words).toBeLessThanOrEqual(1500);
    expect(answer!.bodyMarkdown.match(/^##\s+/gm)?.length ?? 0).toBeLessThanOrEqual(6);
    expect(answer!.quickShare.split(/\s+/).length).toBeLessThanOrEqual(240);
  });

  it("does not pad thin evidence to an artificial target", () => {
    const answer = composeWikiAnswer("How does a narrow rule work?", [{
      ...richChunk(0),
      parentText: "A narrow rule applies only when the plan terms satisfy the stated condition. It does not apply when that condition is absent.",
    }], { kind: "general", facets: ["process", "mechanics"] });
    const words = stripMarkdown(answer!.bodyMarkdown).split(/\s+/).filter(Boolean).length;

    expect(words).toBeLessThan(100);
    expect(answer!.bodyMarkdown).toContain("does not apply");
  });

  it("exposes intent-specific ceilings without forcing every answer to the ceiling", () => {
    expect(answerLengthPolicy({ kind: "definition", nodeId: "1.1", title: "ISO" }, "What is an ISO?").maxWords).toBe(650);
    expect(answerLengthPolicy({ kind: "general", facets: ["tax", "timing"] }, "How and when is this taxed?").maxWords).toBe(1200);
    expect(answerLengthPolicy({ kind: "general", facets: ["tax", "timing", "reporting", "withholding"] }, "Explain tax, timing, reporting, and withholding.").maxWords).toBe(1500);
    expect(isWithinAnswerLengthPolicy("supported ".repeat(1500), { kind: "general", facets: ["tax", "timing", "reporting", "withholding"] }, "Explain tax, timing, reporting, and withholding.")).toBe(true);
    expect(isWithinAnswerLengthPolicy("unsupported padding ".repeat(751), { kind: "general", facets: ["tax", "timing", "reporting", "withholding"] }, "Explain tax, timing, reporting, and withholding.")).toBe(false);
  });

  it("raises depth only when unique directly relevant evidence increases", () => {
    const query = "How do grant, vesting, exercise, tax, withholding, reporting, settlement, and sale work together?";
    const intent: QueryIntent = {
      kind: "general",
      facets: ["process", "tax", "lifecycle", "timing", "withholding", "reporting", "settlement"],
    };
    const thin = createEvidenceProfile(query, [{ ...richChunk(0), parentText: paragraph(1, 1) }], intent, 10);
    const moderate = createEvidenceProfile(query, Array.from({ length: 2 }, (_, index) => richChunk(index)), intent, 10);
    const rich = createEvidenceProfile(query, Array.from({ length: 5 }, (_, index) => richChunk(index)), intent, 10);
    const veryRich = createEvidenceProfile(query, Array.from({ length: 8 }, (_, index) => richChunk(index)), intent, 10);

    expect([thin.tier, moderate.tier, rich.tier, veryRich.tier]).toEqual(["thin", "moderate", "rich", "very-rich"]);
    expect(answerLengthPolicy(intent, query, thin).maxWords)
      .toBeLessThan(answerLengthPolicy(intent, query, moderate).maxWords);
    expect(answerLengthPolicy(intent, query, moderate).maxWords)
      .toBeLessThan(answerLengthPolicy(intent, query, rich).maxWords);
    expect(answerLengthPolicy(intent, query, rich).maxWords)
      .toBeLessThan(answerLengthPolicy(intent, query, veryRich).maxWords);
  });
});
