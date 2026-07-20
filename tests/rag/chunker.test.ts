import { describe, it, expect } from "vitest";
import { chunkMarkdown, splitLeaf } from "@/lib/rag/chunker";

describe("chunkMarkdown — heading paths", () => {
  it("tracks nested heading paths", () => {
    const md = [
      "# Stock Options 101",
      "Intro paragraph about options.",
      "## Taxes",
      "Some tax intro.",
      "### AMT",
      "AMT can apply to ISOs at exercise.",
    ].join("\n");
    const { chunks, title } = chunkMarkdown(md, { docId: "doc" });
    expect(title).toBe("Stock Options 101");
    const amt = chunks.find((c) => c.text.includes("AMT can apply"));
    expect(amt?.headingPath).toBe("Stock Options 101 > Taxes > AMT");
  });

  it("H1 wins over the title fallback", () => {
    const { title } = chunkMarkdown("# Real Title\n\nBody.", {
      title: "filename-fallback",
    });
    expect(title).toBe("Real Title");
  });

  it("uses the fallback title when there is no H1", () => {
    const { title } = chunkMarkdown("Just body text, no heading.", {
      title: "filename-fallback",
    });
    expect(title).toBe("filename-fallback");
  });

  it("does not treat a # inside a fenced code block as a heading", () => {
    const md = [
      "# Doc",
      "Intro.",
      "```python",
      "# this is a comment, not a heading",
      "x = 1",
      "```",
      "## Real Section",
      "Body under real section.",
    ].join("\n");
    const { chunks } = chunkMarkdown(md, { docId: "doc" });
    const paths = new Set(chunks.map((c) => c.headingPath));
    // The comment must not have created a "Doc > this is a comment..." path.
    expect([...paths].some((p) => p.includes("this is a comment"))).toBe(false);
    expect([...paths]).toContain("Doc > Real Section");
  });

  it("assigns a stable parentId per section and groups chunks under it", () => {
    const md = "# T\n\n## A\n\nalpha body.\n\n## B\n\nbeta body.";
    const { chunks, sections } = chunkMarkdown(md, { docId: "mydoc" });
    const aChunk = chunks.find((c) => c.text.includes("alpha"))!;
    const bChunk = chunks.find((c) => c.text.includes("beta"))!;
    expect(aChunk.parentId).not.toBe(bChunk.parentId);
    expect(aChunk.parentId.startsWith("mydoc#")).toBe(true);
    // Every chunk's parentId resolves to a section.
    const sectionIds = new Set(sections.map((s) => s.parentId));
    expect(sectionIds.has(aChunk.parentId)).toBe(true);
    expect(sectionIds.has(bChunk.parentId)).toBe(true);
  });

  it("headingless document becomes one whole-doc section", () => {
    const { chunks, sections } = chunkMarkdown("Plain text with no headings.", {
      docId: "d",
      title: "Fallback",
    });
    expect(sections.length).toBe(1);
    expect(chunks.length).toBeGreaterThan(0);
  });
});

describe("splitLeaf", () => {
  it("returns [] for empty text", () => {
    expect(splitLeaf("")).toHaveLength(0);
    expect(splitLeaf("   ")).toHaveLength(0);
  });

  it("keeps short text as one chunk", () => {
    expect(splitLeaf("short", 500, 80)).toEqual(["short"]);
  });

  it("splits long multi-paragraph text and respects maxChars", () => {
    const text = [
      "A".repeat(400),
      "B".repeat(400),
      "C".repeat(300),
    ].join("\n\n");
    const chunks = splitLeaf(text, 500, 80);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(500));
  });
});
