import { describe, expect, it } from "vitest";
import { answerLengthPolicy, composeWikiAnswer, compressMarkdownToCharacterLimit, createEvidenceProfile, isWithinAnswerLengthPolicy, stripMarkdown } from "../lib/llm/answer-composer";
import type { QueryIntent } from "../lib/llm/query-intent";
import type { RetrievalChunk } from "../lib/rag/types";

function paragraph(section: number, paragraphIndex: number): string {
  const signature = Array.from({ length: 8 }, (_, index) => `section${section}block${paragraphIndex}marker${index}`).join(" ");
  return [
    `Section ${section} paragraph ${paragraphIndex} explains the technical rule and the conditions that determine when it applies. ${signature}`,
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
  it("allows a richly grounded answer to use all relevant evidence without word or heading caps", () => {
    const query = "How do grant, vesting, exercise, tax, withholding, reporting, settlement, and sale work together?";
    const intent: QueryIntent = {
      kind: "general",
      facets: ["process", "tax", "lifecycle", "timing", "withholding", "reporting", "settlement"],
    };
    const answer = composeWikiAnswer(query, Array.from({ length: 8 }, (_, index) => richChunk(index)), intent);
    const words = stripMarkdown(answer!.bodyMarkdown).split(/\s+/).filter(Boolean).length;

    expect(answer).not.toBeNull();
    expect(words).toBeGreaterThanOrEqual(900);
    expect(answer!.bodyMarkdown.match(/^##\s+/gm)?.length ?? 0).toBeGreaterThan(6);
    expect(answer!.quickShare.split(/\s+/).length).toBeGreaterThan(240);
    expect(answer!.bodyMarkdown).toMatch(/^##\s+/);
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

  it("removes a source block's repeated question while preserving its answer", () => {
    const query = "What is an ISO?";
    const answer = composeWikiAnswer(query, [{
      ...richChunk(0),
      parentText: "**What is an ISO?** An ISO is an employee stock option that may qualify for special tax treatment.\n\nThe exercise spread can still be an AMT preference item.",
    }], {
      kind: "definition",
      nodeId: "1.1",
      title: "Incentive stock options (ISOs)",
      topics: ["ISO"],
    });

    expect(answer).not.toBeNull();
    expect(answer!.bodyMarkdown).not.toContain("**What is an ISO?**");
    expect(answer!.bodyMarkdown).toContain("An ISO is an employee stock option");
  });

  it("exposes an unbounded compatibility policy", () => {
    expect(answerLengthPolicy({ kind: "definition", nodeId: "1.1", title: "ISO" }, "What is an ISO?").maxWords).toBe(Infinity);
    expect(answerLengthPolicy({ kind: "general", facets: ["tax", "timing"] }, "How and when is this taxed?").maxWords).toBe(Infinity);
    expect(answerLengthPolicy({ kind: "general", facets: ["tax", "timing", "reporting", "withholding"] }, "Explain tax, timing, reporting, and withholding.").maxWords).toBe(Infinity);
    expect(isWithinAnswerLengthPolicy("supported ".repeat(1500), { kind: "general", facets: ["tax", "timing", "reporting", "withholding"] }, "Explain tax, timing, reporting, and withholding.")).toBe(true);
    expect(isWithinAnswerLengthPolicy("unsupported padding ".repeat(5000), { kind: "general", facets: ["tax", "timing", "reporting", "withholding"] }, "Explain tax, timing, reporting, and withholding.")).toBe(true);
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
    expect(thin.relevantWordCount).toBeLessThan(moderate.relevantWordCount);
    expect(moderate.relevantWordCount).toBeLessThan(rich.relevantWordCount);
    expect(rich.relevantWordCount).toBeLessThan(veryRich.relevantWordCount);
  });

  it("reduces oversized answers only at complete Markdown-unit boundaries", () => {
    const source = [
      "## Overview",
      "The direct answer is supported by the reviewed material.",
      ...Array.from({ length: 30 }, (_, index) => `## Detail ${index}\n\nComplete paragraph ${index} explains the applicable technical condition and its consequence.`),
    ].join("\n\n");
    const compressed = compressMarkdownToCharacterLimit(source, { targetCharacters: 500 });

    expect(compressed.length).toBeLessThanOrEqual(500);
    expect(compressed).toMatch(/^##\s+/);
    expect(compressed).not.toMatch(/\*{1,2}$/);
  });
});
