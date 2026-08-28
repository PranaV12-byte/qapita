import { describe, expect, it } from "vitest";
import type { ArtifactResult } from "../lib/llm/types";
import { normalizeGeneratedArtifact, normalizeGeneratedText } from "../lib/llm/output-normalizer";

describe("generated artifact normalizer", () => {
  it("removes inline node and source citation markers", () => {
    const text = "ISO rules【nodeId=1.1】 also apply【nodeId: 1.2】 and【\"nodeId\":\"1.3\"】 here【sourceId=upload-1】.";
    expect(normalizeGeneratedText(text)).toBe("ISO rules also apply and here.");
  });

  it("cleans headings without changing prose colons", () => {
    const text = [
      "**Tax treatment:**.",
      "The key considerations are:.",
      "- tax at exercise",
      "## Withholding and reporting:.",
    ].join("\n");
    expect(normalizeGeneratedText(text)).toBe([
      "## Tax treatment",
      "The key considerations are:",
      "- tax at exercise",
      "## Withholding and reporting",
    ].join("\n"));
  });

  it("removes prohibited source names and em/en dashes from prose", () => {
    expect(normalizeGeneratedText("NASPP and MyStockOptions explain this — in different ways – sometimes."))
      .toBe("the knowledge base and the knowledge base explain this - in different ways - sometimes.");
  });

  it("preserves structured citations and is idempotent", () => {
    const artifact: ArtifactResult = {
      title: "Tax treatment:.",
      bodyMarkdown: "## Tax treatment:.\n\nSee【nodeId=3.1】.",
      quickShare: "Tax treatment:. See【sourceId=source-1】.",
      citations: [{ nodeId: "3.1", title: "Option taxation" }, { sourceId: "source-1", title: "Uploaded note" }],
    };
    const normalized = normalizeGeneratedArtifact(artifact);
    expect(normalized.citations).toBe(artifact.citations);
    expect(normalizeGeneratedArtifact(normalized)).toEqual(normalized);
    expect(normalized.title).toBe("Tax treatment:");
    expect(normalized.bodyMarkdown).toBe("## Tax treatment\n\nSee.");
    expect(normalized.quickShare).toBe("Tax treatment: See.");
  });

  it("normalizes nested comparison prose without changing citations", () => {
    const citations: ArtifactResult["citations"] = [{ nodeId: "1.1", title: "ISOs" }];
    const artifact: ArtifactResult = {
      title: "Comparison",
      bodyMarkdown: "## Comparison",
      quickShare: "Comparison",
      citations,
      comparison: {
        title: "ISOs vs NSOs:.",
        subtitle: "Guidance from NASPP — kept concise.",
        columns: ["ISOs【nodeId=1.1】", "NSOs【sourceId=upload-1】"],
        rows: [{
          feature: "Tax treatment:.",
          values: ["AMT may apply — depending on the spread.", "MyStockOptions is not a generated source."],
        }],
        takeaway: "Use the knowledge base – and your plan terms – together.",
      },
    };

    const normalized = normalizeGeneratedArtifact(artifact);
    expect(normalized.citations).toBe(citations);
    expect(normalized.comparison).toEqual({
      title: "ISOs vs NSOs:",
      subtitle: "Guidance from the knowledge base - kept concise.",
      columns: ["ISOs", "NSOs"],
      rows: [{
        feature: "Tax treatment:",
        values: ["AMT may apply - depending on the spread.", "the knowledge base is not a generated source."],
      }],
      takeaway: "Use the knowledge base - and your plan terms - together.",
    });
  });
});
