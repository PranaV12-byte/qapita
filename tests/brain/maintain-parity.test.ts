import { describe, it, expect } from "vitest";
import {
  proposePlacement,
  summarizeNode,
  reviewWiki,
  type RawLLMCaller,
} from "@/lib/brain/maintain";

// A caller that returns garbage (or throws) must never crash a maintenance
// operation — each must fall back to its heuristic / empty result. And a
// caller returning valid JSON must be used. LLM_PROVIDER is irrelevant here
// because we inject the caller directly (the real defaultCaller is exercised
// only against a live groq key, which this offline suite never has).

const garbage: RawLLMCaller = async () => ({ nonsense: true, values: [1, 2, 3] });
const nullCaller: RawLLMCaller = async () => null;
const thrower: RawLLMCaller = async () => {
  throw new Error("boom");
};

describe("maintain: proposePlacement", () => {
  it("returns null (→ heuristic) when the caller yields null", async () => {
    const plan = await proposePlacement("Doc", ["section a", "section b"], { caller: nullCaller });
    expect(plan).toBeNull();
  });

  it("returns null when the caller yields Zod-invalid garbage", async () => {
    const plan = await proposePlacement("Doc", ["section a"], { caller: garbage });
    expect(plan).toBeNull();
  });

  it("uses a valid caller response, sanitizing unknown node ids to general", async () => {
    const caller: RawLLMCaller = async () => ({
      sectionNodeIds: ["3.2", "not-a-real-node", "u-new-topic"],
      newNodes: [{ id: "u-new-topic", title: "New Topic" }],
    });
    const plan = await proposePlacement("Doc", ["s0", "s1", "s2"], { caller });
    expect(plan).not.toBeNull();
    expect(plan!.sectionNodeIds).toEqual(["3.2", "general", "u-new-topic"]);
    expect(plan!.newNodes).toEqual([{ id: "u-new-topic", title: "New Topic" }]);
  });

  it("rejects a response whose section count doesn't match", async () => {
    const caller: RawLLMCaller = async () => ({ sectionNodeIds: ["3.2"], newNodes: [] });
    const plan = await proposePlacement("Doc", ["s0", "s1"], { caller });
    expect(plan).toBeNull();
  });

  it("drops a proposed new node that no section actually uses", async () => {
    const caller: RawLLMCaller = async () => ({
      sectionNodeIds: ["3.2"],
      newNodes: [{ id: "u-unused", title: "Unused" }],
    });
    const plan = await proposePlacement("Doc", ["s0"], { caller });
    expect(plan!.newNodes).toEqual([]);
  });
});

describe("maintain: summarizeNode", () => {
  it("falls back to an extractive summary when the caller is null", async () => {
    const summary = await summarizeNode(
      "RSU tax",
      ["RSUs are taxed as ordinary income at vesting. More detail follows here."],
      { caller: nullCaller }
    );
    expect(summary).toContain("RSUs are taxed as ordinary income at vesting.");
  });

  it("falls back to extractive when the caller throws", async () => {
    const summary = await summarizeNode("RSU tax", ["First sentence. Second sentence."], {
      caller: thrower,
    });
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain("First sentence.");
  });

  it("uses a valid LLM summary when provided", async () => {
    const caller: RawLLMCaller = async () => ({ summary: "A crisp model summary." });
    const summary = await summarizeNode("RSU tax", ["raw passage text"], { caller });
    expect(summary).toBe("A crisp model summary.");
  });

  it("returns the node title for a node with no passages", async () => {
    const summary = await summarizeNode("Empty node", [], { caller: nullCaller });
    expect(summary).toBe("Empty node");
  });
});

describe("maintain: reviewWiki", () => {
  it("returns [] for fewer than 2 sources", async () => {
    const out = await reviewWiki([{ sourceId: "s1", title: "a", preview: "x" }], { caller: garbage });
    expect(out).toEqual([]);
  });

  it("returns [] (not a throw) on garbage / null callers", async () => {
    const sources = [
      { sourceId: "s1", title: "a", preview: "x" },
      { sourceId: "s2", title: "b", preview: "y" },
    ];
    expect(await reviewWiki(sources, { caller: garbage })).toEqual([]);
    expect(await reviewWiki(sources, { caller: nullCaller })).toEqual([]);
    expect(await reviewWiki(sources, { caller: thrower })).toEqual([]);
  });

  it("passes through valid findings, filtering unknown sourceIds", async () => {
    const caller: RawLLMCaller = async () => ({
      findings: [
        { type: "contradiction", severity: "warn", message: "conflict", sourceIds: ["s1", "ghost"] },
      ],
    });
    const out = await reviewWiki(
      [
        { sourceId: "s1", title: "a", preview: "x" },
        { sourceId: "s2", title: "b", preview: "y" },
      ],
      { caller }
    );
    expect(out).toHaveLength(1);
    expect(out[0].sourceIds).toEqual(["s1"]);
  });
});
