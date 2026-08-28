import { describe, expect, it } from "vitest";
import { isRedundantArtifactTitle, shortenTitle, titleFromQuery } from "../lib/llm/title";

describe("artifact titles", () => {
  it("keeps the complete question as the title when it fits", () => {
    expect(titleFromQuery("An employee exercised a large ISO grant this year. Could they owe AMT even if they did not sell the shares?")).toContain("AMT even if they did not sell the shares");
  });

  it("shortens only at a word boundary", () => {
    const title = shortenTitle("A very long question about tender offers for private company employees and how their liquidity opportunity works in practice", 64);
    expect(title).toMatch(/…$/);
    expect(title).not.toMatch(/employe…$/);
  });

  it("uses the canonical topic title for simple definition questions", () => {
    expect(titleFromQuery("What is an ISO?")).toBe("Incentive stock options (ISOs)");
    expect(titleFromQuery("What are RSUs?")).toBe("RSUs & RSAs");
  });

  it("detects only titles that repeat the complete question", () => {
    expect(isRedundantArtifactTitle("What is stock appreciation right", "What is stock appreciation right?")).toBe(true);
    expect(isRedundantArtifactTitle("ISO & NSO", "ISO and NSO")).toBe(true);
    expect(isRedundantArtifactTitle("Incentive stock options (ISOs)", "What is an ISO?")).toBe(false);
  });
});
