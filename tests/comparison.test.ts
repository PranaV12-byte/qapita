import { describe, expect, it } from "vitest";
import type { RetrievalChunk } from "../lib/rag/types";
import {
  buildGroundedComparison,
  ComparisonDataSchema,
  comparisonToMarkdown,
  extractComparisonSides,
} from "../lib/llm/comparison";

function chunk(nodeId: string, title: string, text: string): RetrievalChunk {
  return {
    nodeId,
    title,
    text,
    parentText: text,
    parentId: `${nodeId}:parent`,
    tier: "curated",
    score: 1,
    cosine: 0.9,
  };
}

const validComparison = (columns: string[]) => ({
  title: "Award comparison",
  subtitle: "A concise comparison of the named topics.",
  columns,
  rows: [{
    feature: "Tax treatment",
    values: columns.map((column) => `${column} has distinct tax treatment.`),
  }],
  takeaway: "Use the award terms and applicable tax rules together.",
});

describe("structured comparison contract", () => {
  it("accepts two, three, and four topic columns", () => {
    for (const columns of [["ISOs", "NSOs"], ["ISOs", "NSOs", "RSUs"], ["ISOs", "NSOs", "RSUs", "PSUs"]]) {
      expect(ComparisonDataSchema.safeParse(validComparison(columns)).success).toBe(true);
    }
    expect(ComparisonDataSchema.safeParse(validComparison(["ISOs", "isos"])).success).toBe(false);
  });

  it("rejects unsupported sizes, empty values, mismatched rows, and too many rows", () => {
    expect(ComparisonDataSchema.safeParse(validComparison(["ISOs"])).success).toBe(false);
    expect(ComparisonDataSchema.safeParse(validComparison(["ISOs", "NSOs", "RSUs", "PSUs", "ESPPs"])).success).toBe(false);
    expect(ComparisonDataSchema.safeParse({ ...validComparison(["ISOs", "NSOs"]), rows: [{ feature: "", values: ["one", "two"] }] }).success).toBe(false);
    expect(ComparisonDataSchema.safeParse({ ...validComparison(["ISOs", "NSOs"]), rows: [{ feature: "Tax", values: ["only one"] }] }).success).toBe(false);
    expect(ComparisonDataSchema.safeParse({ ...validComparison(["ISOs", "NSOs"]), rows: Array.from({ length: 13 }, () => ({ feature: "Tax", values: ["one", "two"] })) }).success).toBe(false);
  });

  it("grounds every named ISO and NSO side without inventing unrelated columns", () => {
    const result = buildGroundedComparison("What is the difference between ISOs and NSOs?", [
      chunk("1.1", "Incentive stock options", "ISOs can receive special tax treatment when statutory holding requirements are met. The exercise spread can create an AMT preference item."),
      chunk("1.2", "Non-qualified stock options", "NSOs are generally taxed on the exercise spread as ordinary income. The employer usually reports the spread through payroll."),
      chunk("5.1", "SEC registration", "Form S-8 can register shares issued under an employee benefit plan. The filing supports securities-law compliance."),
    ]);

    expect(result).not.toBeNull();
    expect(result?.columns).toEqual(["Incentive stock options (ISOs)", "Non-qualified stock options (NSOs)"]);
    expect(result?.rows.every((row) => row.values.length === result!.columns.length)).toBe(true);
    expect(result?.columns.join(" ")).not.toContain("SEC");
    expect(comparisonToMarkdown(result!)).not.toContain("|");
  });

  it("supports two named topics grounded by one combined reviewed article", () => {
    const result = buildGroundedComparison("Compare RSUs and RSAs for employees.", [
      chunk("1.3", "RSUs & RSAs", "An RSA transfers shares at grant, while an RSU is a promise to deliver shares at vesting. RSAs can support an 83(b) election, while RSUs are generally taxed at delivery."),
    ]);

    expect(result).not.toBeNull();
    expect(result?.columns).toEqual(["RSUs", "RSAs"]);
    expect(result?.rows[0]?.values).toHaveLength(2);
  });

  it("returns no comparison when a named side has no evidence or too many sides are requested", () => {
    const chunks = [chunk("1.1", "Incentive stock options", "ISOs can receive special tax treatment when statutory holding requirements are met. The exercise spread can create an AMT preference item.")];
    expect(buildGroundedComparison("Compare ISOs and NSOs.", chunks)).toBeNull();
    expect(buildGroundedComparison("Compare company and employee.", chunks)).toBeNull();
    expect(extractComparisonSides("Compare ISOs, NSOs, RSUs, PSUs, and ESPPs.").tooMany).toBe(true);
  });

  it("keeps a comparison qualifier out of the topic columns", () => {
    expect(extractComparisonSides("Compare ISOs and NSOs; focus on tax and timing").sides)
      .toEqual(["ISOs", "NSOs"]);
  });
});
