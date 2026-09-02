import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRESET_ANSWERS } from "../lib/generate/preset-answers";
import { getNode } from "../lib/content/tree";

describe("Ask a Question preset demonstrations", () => {
  it("keeps the five requested cards in their approved order", () => {
    expect(PRESET_ANSWERS.map((preset) => preset.question)).toEqual([
      "What's the difference between ISOs and NSOs?",
      "How do stock options, RSUs, and cash-settled awards compare?",
      "How does Section 409A affect stock option grants?",
      "How does ASC 718 accounting work for stock-based compensation?",
      "How does double-trigger vesting work for RSUs?",
    ]);
  });

  it("uses only published Wiki topics and clean display Markdown", () => {
    for (const preset of PRESET_ANSWERS) {
      expect(preset.bodyMarkdown).not.toMatch(/&#x[0-9a-f]+;|[【】]|node\s*id|source\s*id|[\u2013\u2014]/i);
      expect(preset.bodyMarkdown).not.toMatch(/:\./);
      expect(preset.quickShare.trim()).not.toHaveLength(0);
      expect(preset.citations.length).toBeGreaterThan(0);

      for (const citation of preset.citations) {
        const node = getNode(citation.nodeId);
        expect(node).toBeDefined();
        expect(node?.contentState).not.toBe("planned");
      }
    }
  });

  it("keeps preset clicks client-only and separate from live generation", () => {
    const source = readFileSync(resolve(process.cwd(), "app", "generate", "client.tsx"), "utf8");
    const presetHandler = source.slice(source.indexOf("const doPresetSubmit"), source.indexOf("const requestSubmit"));

    expect(source).toContain("PRESET_ANSWERS.map");
    expect(presetHandler).toContain("await waitForPresetDelay()");
    expect(presetHandler).toContain('setFormat("reference")');
    expect(presetHandler).not.toContain("fetch(");
    expect(presetHandler).toContain("preset-${preset.id}-${uniquePart}");
  });
});
