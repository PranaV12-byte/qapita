import { describe, expect, it } from "vitest";
import { hasGroundedEvidence } from "../lib/rag/relevance";
import type { RetrievalChunk } from "../lib/rag/types";

function chunk(title: string, text: string): RetrievalChunk {
  return { tier: "curated", title, text, score: 1, cosine: 0.12 };
}

describe("retrieval evidence confidence", () => {
  const equityChunks = [
    chunk("Incentive stock options (ISOs)", "An ISO can receive preferential tax treatment when statutory requirements are met."),
    chunk("RSUs and RSAs", "RSUs are generally taxable when shares are delivered after vesting."),
  ];

  it("accepts supported equity questions even when hash cosine is low", () => {
    expect(hasGroundedEvidence("What is an ISO?", equityChunks)).toBe(true);
    expect(hasGroundedEvidence("How are RSUs taxed?", equityChunks)).toBe(true);
  });

  it("rejects unrelated questions despite incidental dense similarity", () => {
    expect(hasGroundedEvidence("What is the weather on Mars?", equityChunks)).toBe(false);
  });

  it("rejects a planned topic when no evidence contains it", () => {
    expect(hasGroundedEvidence("Explain QSBS", equityChunks)).toBe(false);
  });
});
