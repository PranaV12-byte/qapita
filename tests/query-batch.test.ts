import { describe, expect, it } from "vitest";
import { splitIndependentQuestions } from "../lib/llm/query-batch";

describe("independent question splitting", () => {
  it("splits several simple definitions into independently retrievable questions", () => {
    expect(splitIndependentQuestions("What is an ISO? What are RSUs and liquidity?").parts).toEqual([
      "What is an ISO?",
      "What is RSU?",
      "What is liquidity?",
    ]);
  });

  it("keeps one tax question and explicit comparisons intact", () => {
    expect(splitIndependentQuestions("How are ISOs and NSOs taxed?").parts).toEqual([
      "How are ISOs and NSOs taxed?",
    ]);
    expect(splitIndependentQuestions("Compare ISOs versus NSOs.").parts).toEqual([
      "Compare ISOs versus NSOs.",
    ]);
  });

  it("returns a refinement signal when more than four questions are supplied", () => {
    const batch = splitIndependentQuestions(
      "What is an ISO? What is an NSO? What is an RSU? What is a SAR? What is an ESPP?"
    );
    expect(batch.parts).toHaveLength(4);
    expect(batch.tooMany).toBe(true);
  });
});
