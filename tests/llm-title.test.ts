import { describe, expect, it } from "vitest";
import { shortenTitle, titleFromQuery } from "../lib/llm/title";

describe("artifact titles", () => {
  it("keeps the complete question as the title when it fits", () => {
    expect(titleFromQuery("An employee exercised a large ISO grant this year. Could they owe AMT even if they did not sell the shares?")).toContain("AMT even if they did not sell the shares");
  });

  it("shortens only at a word boundary", () => {
    const title = shortenTitle("A very long question about tender offers for private company employees and how their liquidity opportunity works in practice", 64);
    expect(title).toMatch(/…$/);
    expect(title).not.toMatch(/employe…$/);
  });
});
