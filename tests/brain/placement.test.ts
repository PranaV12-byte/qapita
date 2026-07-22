import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { planPlacement } from "@/lib/brain/placement";
import { clearNodeTargetsCache } from "@/lib/brain/healthCheck";
import type { Embedder } from "@/lib/rag/types";

class FakePassageEmbedder implements Embedder {
  readonly id = "fake-placement";
  readonly dim = 4;
  constructor(private readonly map: Record<string, number[]>) {}
  private vecFor(text: string): Float32Array {
    for (const [key, vec] of Object.entries(this.map)) {
      if (text.includes(key)) return Float32Array.from(vec);
    }
    return new Float32Array(this.dim);
  }
  async embedQuery(text: string): Promise<Float32Array> {
    return this.vecFor(text);
  }
  async embedPassage(text: string): Promise<Float32Array> {
    return this.vecFor(text);
  }
  async embedPassages(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => this.vecFor(t));
  }
}

function freshDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "q4np-placement-test-"));
}

beforeEach(() => {
  clearNodeTargetsCache();
});

describe("planPlacement: multi-topic document lands on multiple existing nodes", () => {
  it("assigns each section independently based on its own content", async () => {
    // Section 1 (under the H1, two paragraphs so extractTitleAndLead's lead
    // capture stops before reaching section 2) is unambiguously RSU_MARKER;
    // section 2 (a distinct H2) is unambiguously ISO_MARKER. The doc-level
    // probe (title + lead) only ever sees RSU_MARKER, so it confidently
    // matches an existing node and the "novel node" path is never taken.
    const doc = [
      "# Mixed equity note",
      "",
      "RSU_MARKER paragraph one about vesting schedules.",
      "",
      "RSU_MARKER paragraph two with more detail.",
      "",
      "## Second section",
      "",
      "ISO_MARKER content entirely separate from the above.",
    ].join("\n");

    const embedder = new FakePassageEmbedder({
      "RSU_MARKER": [1, 0, 0, 0],
      "RSU & ESPP tax": [1, 0, 0, 0], // real node 3.2's title
      "ISO_MARKER": [0, 1, 0, 0],
      "Incentive stock options (ISOs)": [0, 1, 0, 0], // real node 1.1's title
    });

    const plan = await planPlacement("Mixed equity note", doc, {
      embedder,
      dataDir: freshDataDir(),
    });

    expect(plan.newNodes).toEqual([]);
    expect(plan.sectionNodeIds.length).toBe(2);
    expect(new Set(plan.sectionNodeIds).size).toBeGreaterThanOrEqual(2);
    expect(plan.sectionNodeIds).toContain("3.2");
    expect(plan.sectionNodeIds).toContain("1.1");
  });
});

describe("planPlacement: a coherent-but-novel document proposes one new node", () => {
  it("proposes a single u- node covering all of the document's sections", async () => {
    const doc = "# Something totally new\n\nNOVEL_MARKER content about a topic that doesn't match any existing node well.";

    // NOVEL_MARKER's vector has cosine exactly 0.38 against the one mapped
    // real node — strictly between CLASSIFY_MIN_CONFIDENCE (0.3) and
    // CLASSIFY_NODE_CONFIDENCE (0.45): "not off-topic, but not a confident
    // match either" is precisely the novel-candidate band.
    const embedder = new FakePassageEmbedder({
      "RSU & ESPP tax": [1, 0, 0, 0],
      "NOVEL_MARKER": [0.38, Math.sqrt(1 - 0.38 * 0.38), 0, 0],
    });

    const plan = await planPlacement("Something totally new", doc, {
      embedder,
      dataDir: freshDataDir(),
    });

    expect(plan.newNodes.length).toBe(1);
    expect(plan.newNodes[0].id).toMatch(/^u-/);
    expect(plan.newNodes[0].title).toBe("Something totally new");
    expect(plan.sectionNodeIds.every((id) => id === plan.newNodes[0].id)).toBe(true);
  });

  it("does NOT propose a new node when the document confidently matches an existing one", async () => {
    const doc = "# RSU note\n\nRSU_MARKER content clearly about an existing topic.";
    const embedder = new FakePassageEmbedder({
      "RSU_MARKER": [1, 0, 0, 0],
      "RSU & ESPP tax": [1, 0, 0, 0],
    });
    const plan = await planPlacement("RSU note", doc, { embedder, dataDir: freshDataDir() });
    expect(plan.newNodes).toEqual([]);
    expect(plan.sectionNodeIds).toEqual(["3.2"]);
  });

  it("does NOT propose a new node when the document is simply off-topic", async () => {
    const doc = "# Cookies\n\nA chocolate chip cookie recipe with no relation to equity compensation.";
    const embedder = new FakePassageEmbedder({
      "RSU & ESPP tax": [1, 0, 0, 0],
    });
    const plan = await planPlacement("Cookies", doc, { embedder, dataDir: freshDataDir() });
    expect(plan.newNodes).toEqual([]);
    expect(plan.sectionNodeIds).toEqual(["general"]);
  });
});

describe("planPlacement: edge cases", () => {
  it("returns an empty plan for content with no sections", async () => {
    const embedder = new FakePassageEmbedder({});
    const plan = await planPlacement("Empty", "", { embedder, dataDir: freshDataDir() });
    expect(plan).toEqual({ sectionNodeIds: [], newNodes: [] });
  });
});
