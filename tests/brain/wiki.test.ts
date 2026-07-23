// V1 (SPEC-VAULT §V1) — the wiki page model: buildNotePage per kind, backlink
// correctness (feeding source, crossLink, [[mention]], cited-by-answer), and
// authorNodeSynthesis parity (valid / garbage / throwing caller → template).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chunkMarkdown } from "@/lib/rag/chunker";
import { createBrainStore, type BrainStore } from "@/lib/brain/store";
import { weaveSource, type PlacementPlan } from "@/lib/brain/weave";
import { buildNotePage } from "@/lib/brain/wiki";
import { authorNodeSynthesis, type RawLLMCaller } from "@/lib/brain/maintain";
import type { Embedder } from "@/lib/rag/types";

class FakeEmbedder implements Embedder {
  readonly id = "fake-wiki";
  readonly dim = 4;
  async embedQuery(): Promise<Float32Array> {
    return new Float32Array(this.dim);
  }
  async embedPassage(t: string): Promise<Float32Array> {
    return this.vec(t);
  }
  async embedPassages(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => this.vec(t));
  }
  private vec(text: string): Float32Array {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return Float32Array.from([(h % 97) / 97, ((h >>> 5) % 97) / 97, 0, 0]);
  }
}
const embedder = new FakeEmbedder();

function freshStore(): BrainStore {
  return createBrainStore(fs.mkdtempSync(path.join(os.tmpdir(), "q4np-wiki-test-")));
}

const BRAIN = "33333333-3333-3333-3333-333333333333";

const DOC_TAX =
  "# RSU tax note\n\nRestricted stock units are taxed as ordinary income at vest, based on the fair market value that day.";

async function weaveTaxDoc(store: BrainStore, sourceId = "s-tax", fileName = "rsu-tax.md") {
  const plan: PlacementPlan = {
    sectionNodeIds: chunkMarkdown(DOC_TAX, { title: "RSU tax note" }).sections.map(() => "3.2"),
    newNodes: [],
  };
  return weaveSource({
    brainId: BRAIN,
    sourceId,
    fileName,
    format: "markdown",
    originalBuffer: Buffer.from(DOC_TAX),
    title: "RSU tax note",
    markdown: DOC_TAX,
    plan,
    contentHash: `h-${sourceId}`,
    probeVector: new Float32Array(4),
    embedder,
    store,
  });
}

describe("buildNotePage: topic", () => {
  it("combines the curated article, the user's attributed passages, and synthesis", async () => {
    const store = freshStore();
    await weaveTaxDoc(store);

    const page = await buildNotePage(BRAIN, "3.2", { store });
    expect(page).not.toBeNull();
    expect(page!.kind).toBe("topic");
    expect(page!.title).toBe("RSU & ESPP tax");
    expect(page!.markdown).toContain("## From your sources");
    expect(page!.markdown).toContain("rsu-tax.md");
    expect(page!.markdown).toContain("ordinary income at vest");
    expect(page!.markdown).toContain("## Synthesis");

    // The feeding source is a backlink.
    expect(page!.backlinks.some((b) => b.kind === "source" && b.id === "source:s-tax")).toBe(true);
  });
});

describe("buildNotePage: source", () => {
  it("returns the extracted markdown verbatim with feed backlinks", async () => {
    const store = freshStore();
    await weaveTaxDoc(store);

    const page = await buildNotePage(BRAIN, "source:s-tax", { store });
    expect(page).not.toBeNull();
    expect(page!.kind).toBe("source");
    expect(page!.title).toBe("rsu-tax.md");
    expect(page!.markdown).toBe(DOC_TAX);
    expect(page!.meta.feeds).toBe("3.2");
    // The node it feeds is a backlink from the source's perspective.
    expect(page!.backlinks.some((b) => b.id === "3.2")).toBe(true);
  });
});

describe("buildNotePage: pillar index", () => {
  it("lists its topics as [[links]]", async () => {
    const page = await buildNotePage(null, "pillar:tax", {});
    expect(page).not.toBeNull();
    expect(page!.kind).toBe("pillar");
    expect(page!.markdown).toContain("[[RSU & ESPP tax]]");
  });
});

describe("buildNotePage: backlinks from answers", () => {
  it("surfaces a logged answer that cited the node", async () => {
    const store = freshStore();
    await weaveTaxDoc(store);
    store.appendAnswer(BRAIN, {
      artifactId: "art-1",
      query: "How are RSUs taxed?",
      title: "RSU taxation",
      citations: [{ kind: "topic", nodeId: "3.2", title: "RSU & ESPP tax" }],
      ts: new Date().toISOString(),
    });

    const page = await buildNotePage(BRAIN, "3.2", { store });
    expect(page!.backlinks.some((b) => b.kind === "answer" && b.id === "answer:art-1")).toBe(true);
  });
});

describe("buildNotePage: crossLink + [[mention]] backlinks", () => {
  it("a source feeding two u-nodes links them, and the synthesis mention is a backlink", async () => {
    const store = freshStore();
    const DOC = ["# Combo", "", "## Alpha", "", "Alpha content about grants.", "", "## Beta", "", "Beta content about vesting."].join("\n");
    const { sections } = chunkMarkdown(DOC, { title: "Combo" });
    expect(sections.length).toBe(2);
    const plan: PlacementPlan = {
      sectionNodeIds: ["u-alpha", "u-beta"],
      newNodes: [
        { id: "u-alpha", title: "Alpha topic" },
        { id: "u-beta", title: "Beta topic" },
      ],
    };
    await weaveSource({
      brainId: BRAIN,
      sourceId: "s-combo",
      fileName: "combo.md",
      format: "markdown",
      originalBuffer: Buffer.from(DOC),
      title: "Combo",
      markdown: DOC,
      plan,
      contentHash: "h-combo",
      probeVector: new Float32Array(4),
      embedder,
      store,
    });

    // The synthesis for u-alpha should link to its crossLink partner "Beta topic".
    const alphaWiki = fs.readFileSync(path.join(store.brainPaths(BRAIN).dir, "wiki", "u-alpha.md"), "utf-8");
    expect(alphaWiki).toContain("[[Beta topic]]");

    const betaPage = await buildNotePage(BRAIN, "u-beta", { store });
    expect(betaPage!.kind).toBe("user-node");
    expect(betaPage!.markdown).toContain("## Synthesis");
    expect(betaPage!.markdown).toContain("## From your sources");
    // u-alpha links to u-beta (crossLink + [[mention]]) → a backlink of u-beta.
    expect(betaPage!.backlinks.some((b) => b.id === "u-alpha")).toBe(true);
  });
});

describe("authorNodeSynthesis: LLM parity", () => {
  const passages = [{ source: "a.md", text: "Alpha sentence one is here. Second sentence follows." }];

  it("uses a valid caller's markdown", async () => {
    const caller: RawLLMCaller = async () => ({ markdown: "# Custom synthesis\n\nBody with [[RSUs]]." });
    const out = await authorNodeSynthesis("Alpha", passages, ["RSUs"], { caller });
    expect(out).toContain("# Custom synthesis");
  });

  it("falls back to the template on garbage output", async () => {
    const caller: RawLLMCaller = async () => ({ not: "the schema" });
    const out = await authorNodeSynthesis("Alpha", passages, ["RSUs"], { caller });
    expect(out).toContain("**a.md**");
    expect(out).toContain("[[RSUs]]");
  });

  it("falls back to the template when the caller throws", async () => {
    const caller: RawLLMCaller = async () => {
      throw new Error("boom");
    };
    const out = await authorNodeSynthesis("Alpha", passages, [], { caller });
    expect(out).toContain("**a.md**");
  });
});
