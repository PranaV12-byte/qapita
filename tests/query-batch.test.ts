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

  it("keeps every independent definition within the input limit", () => {
    const batch = splitIndependentQuestions(
      "What is an ISO? What is an NSO? What is an RSU? What is a SAR? What is an ESPP?"
    );
    expect(batch.parts).toEqual([
      "What is an ISO?",
      "What is an NSO?",
      "What is an RSU?",
      "What is a SAR?",
      "What is an ESPP?",
    ]);
  });

  it("splits independent topic clauses but keeps inherited conditions together", () => {
    expect(splitIndependentQuestions("How are ISOs taxed and what happens to RSUs after termination?").parts)
      .toEqual(["How are ISOs taxed?", "what happens to RSUs after termination?"]);
    expect(splitIndependentQuestions("What is an ISO and how is it taxed?").parts)
      .toEqual(["What is an ISO and how is it taxed?"]);
    expect(splitIndependentQuestions("Can exercising ISOs trigger AMT if the shares are not sold?").parts)
      .toEqual(["Can exercising ISOs trigger AMT if the shares are not sold?"]);
    expect(splitIndependentQuestions("What is an ISO? What happens if it is exercised?").parts)
      .toEqual(["What is an ISO? What happens if it is exercised?"]);
    expect(splitIndependentQuestions("Compare ISOs and NSOs; focus on tax and timing").parts)
      .toEqual(["Compare ISOs and NSOs; focus on tax and timing?"]);
  });
});
