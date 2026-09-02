import { describe, expect, it } from "vitest";
import type { ArtifactResult } from "../lib/llm/types";
import { isUsableGeneratedArtifact, normalizeGeneratedArtifact, normalizeGeneratedText } from "../lib/llm/output-normalizer";

describe("generated artifact normalizer", () => {
  it("removes inline node and source citation markers", () => {
    const text = "ISO rules【nodeId=1.1】 also apply【nodeId: 1.2】 and【\"nodeId\":\"1.3\"】 here【sourceId=upload-1】 plus [sourceId: upload-2].";
    expect(normalizeGeneratedText(text)).toBe("ISO rules also apply and here.");
  });

  it("removes known identifier wrappers without removing legitimate legal numbers", () => {
    expect(normalizeGeneratedText("See (node 1.1), [Node ID: 1.2], and (sourceId=upload-1). IRC Section 409A still applies.", ["1.1", "1.2", "upload-1"]))
      .toBe("See. IRC Section 409A still applies.");
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

  it("removes provider reference framing", () => {
    expect(normalizeGeneratedText("## Reference Guide\n\nAccording to the knowledge base, the spread is taxed at exercise."))
      .toBe("the spread is taxed at exercise.");
  });

  it("removes prohibited source names and em/en dashes from prose", () => {
    expect(normalizeGeneratedText("NASPP and MyStockOptions explain this — in different ways – sometimes."))
      .toBe("this - in different ways - sometimes.");
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
    expect(normalized.bodyMarkdown).toBe("See.");
    expect(normalized.quickShare).toBe("Tax treatment: See.");
  });

  it("removes only an exact leading title or question echo", () => {
    const artifact: ArtifactResult = {
      title: "What is an ISO?",
      bodyMarkdown: "What is an ISO?\n\nAn incentive stock option is an employee stock option that may receive statutory tax treatment.",
      quickShare: "What is an ISO?\n\nAn incentive stock option may receive statutory tax treatment.",
      citations: [],
    };
    const normalized = normalizeGeneratedArtifact(artifact, "What is an ISO?");
    expect(normalized.bodyMarkdown).toBe("An incentive stock option is an employee stock option that may receive statutory tax treatment.");
    expect(normalized.quickShare).toBe("An incentive stock option may receive statutory tax treatment.");
    expect(normalizeGeneratedArtifact(normalized, "What is an ISO?")).toEqual(normalized);
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
        subtitle: "Guidance - kept concise.",
      columns: ["ISOs", "NSOs"],
      rows: [{
        feature: "Tax treatment:",
          values: ["AMT may apply - depending on the spread.", "the available guidance is not a generated source."],
      }],
      takeaway: "Use the knowledge base - and your plan terms - together.",
    });
  });

  it("rejects empty, unsafe, or structurally broken provider output", () => {
    const base: ArtifactResult = { title: "Answer", bodyMarkdown: "A complete answer.", quickShare: "A complete answer.", citations: [] };
    expect(isUsableGeneratedArtifact(base)).toBe(true);
    expect(isUsableGeneratedArtifact({ ...base, bodyMarkdown: "" })).toBe(false);
    expect(isUsableGeneratedArtifact({ ...base, bodyMarkdown: "Answer【nodeId=1.1】" })).toBe(false);
    expect(isUsableGeneratedArtifact({ ...base, bodyMarkdown: "**Unclosed heading" })).toBe(false);
  });
});
