import { describe, it, expect } from "vitest";
import { resolveCitations } from "@/lib/brain/retrieval";
import { GENERAL_NODE_TITLE } from "@/lib/rag/config";
import type { RetrievalChunk } from "@/lib/rag/types";

const chunk = (over: Partial<RetrievalChunk>): RetrievalChunk => ({
  tier: "curated",
  text: "x",
  score: 1,
  cosine: 1,
  isScenario: false,
  ...over,
});

describe("resolveCitations", () => {
  it("resolves a curated topic node to its tree title with kind=topic", () => {
    const cites = resolveCitations([chunk({ tier: "curated", nodeId: "3.2" })], null);
    expect(cites).toEqual([
      { kind: "topic", nodeId: "3.2", title: "RSU & ESPP tax" },
    ]);
  });

  it("resolves the general bucket to its title", () => {
    const cites = resolveCitations([chunk({ tier: "scrape", nodeId: "general" })], null);
    expect(cites).toEqual([{ kind: "topic", nodeId: "general", title: GENERAL_NODE_TITLE }]);
  });

  it("resolves a user source chunk to kind=source with its title (no getNode drop)", () => {
    const cites = resolveCitations(
      [chunk({ tier: "user", sourceId: "src-9", title: "my-notes.md", nodeId: "3.2" })],
      null
    );
    // A user chunk cites its SOURCE, not the topic it happened to land on.
    expect(cites).toEqual([{ kind: "source", sourceId: "src-9", title: "my-notes.md" }]);
  });

  it("resolves a user-node chunk (u- id) to kind=user-node", () => {
    const cites = resolveCitations(
      [chunk({ tier: "user", nodeId: "u-my-topic", title: "Novel Topic" })],
      null
    );
    expect(cites).toEqual([{ kind: "user-node", nodeId: "u-my-topic", title: "Novel Topic" }]);
  });

  it("dedupes by the identity the UI links on, order-preserving", () => {
    const cites = resolveCitations(
      [
        chunk({ tier: "curated", nodeId: "3.2" }),
        chunk({ tier: "curated", nodeId: "3.2" }),
        chunk({ tier: "user", sourceId: "src-1", title: "a.md" }),
        chunk({ tier: "user", sourceId: "src-1", title: "a.md" }),
      ],
      null
    );
    expect(cites).toHaveLength(2);
    expect(cites[0].nodeId).toBe("3.2");
    expect(cites[1].sourceId).toBe("src-1");
  });

  it("drops a chunk with an unknown/absent node rather than emitting a dead citation", () => {
    const cites = resolveCitations(
      [chunk({ tier: "curated", nodeId: "does-not-exist" }), chunk({ tier: "curated" })],
      null
    );
    expect(cites).toEqual([]);
  });
});
