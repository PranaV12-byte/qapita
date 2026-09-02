import { describe, expect, it } from "vitest";
import { selectAnswerGrounding } from "../lib/llm/grounding";
import type { RetrievalChunk } from "../lib/rag/types";

function chunk(nodeId: string, title: string, text: string): RetrievalChunk {
  return { nodeId, title, text, parentText: text, parentId: `${nodeId}:parent`, tier: "curated", score: 1, cosine: 0.8 };
}

describe("answer grounding", () => {
  it("keeps tender-offer evidence and drops generic equity padding", () => {
    const selected = selectAnswerGrounding("How does a tender offer work for private company employees?", [
      chunk("2.5", "Liquidity and exits", "A tender offer gives eligible private-company employees a defined opportunity to sell shares during a company-sponsored liquidity event."),
      chunk("6.1", "S-8 registration", "A company employee share award can require S-8 registration."),
      chunk("1.4", "ESPP", "Employees may purchase company shares through an ESPP."),
      chunk("5.6", "Rule 144", "Rule 144 can affect sales of restricted shares."),
      chunk("4.9", "409A", "Option valuation can create 409A issues."),
    ]);
    expect(selected.answerable).toBe(true);
    expect(selected.chunks.map((item) => item.nodeId)).toEqual(["2.5"]);
  });

  it("keeps both named sides of an ISO and NSO comparison", () => {
    const selected = selectAnswerGrounding("What is the difference between ISOs and NSOs?", [
      chunk("1.1", "Incentive stock options", "ISOs can receive special tax treatment when holding requirements are met."),
      chunk("1.2", "Nonqualified stock options", "NSOs are generally taxed on the exercise spread."),
      chunk("3.1", "Taxation", "The exercise spread and AMT are tax considerations for equity awards."),
    ]);
    expect(selected.answerable).toBe(true);
    expect(selected.chunks.map((item) => item.nodeId)).toContain("1.1");
    expect(selected.chunks.map((item) => item.nodeId)).toContain("1.2");
  });

  it("accepts one strongly grounded section", () => {
    const selected = selectAnswerGrounding("How does an employee exercise an NSO?", [
      chunk("2.3", "Exercise", "An employee exercises an NSO by paying the exercise price and receiving the shares."),
    ]);
    expect(selected.answerable).toBe(true);
    expect(selected.chunks).toHaveLength(1);
  });

  it("does not qualify user evidence from a filename alone", () => {
    const selected = selectAnswerGrounding("What is an ISO?", [
      {
        ...chunk("u-1", "ISO-notes.pdf", "This document covers general compensation administration."),
        tier: "user",
        sourceId: "upload-1",
      },
    ], { definitionNodeId: "1.1", intent: { kind: "definition", nodeId: "1.1", title: "Incentive stock options (ISOs)" } });
    expect(selected.answerable).toBe(false);
  });

  it("does not answer a comparison when one named side is unsupported", () => {
    const selected = selectAnswerGrounding("Compare ISOs and NSOs.", [
      chunk("1.1", "Incentive stock options", "ISOs can receive special tax treatment when holding requirements are met."),
    ]);
    expect(selected.answerable).toBe(false);
  });
});
