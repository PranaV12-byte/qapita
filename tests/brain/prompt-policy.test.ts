import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT, buildUserMessage } from "@/lib/llm/prompt";
import type { RetrievalChunk } from "@/lib/rag/types";

const chunk = (over: Partial<RetrievalChunk>): RetrievalChunk => ({
  tier: "curated",
  text: "body text",
  score: 1,
  cosine: 1,
  isScenario: false,
  ...over,
});

describe("SYSTEM_PROMPT — Phase 4 quoting policy + injection defense", () => {
  it("permits attributed quoting (no longer forbids reproduction)", () => {
    expect(SYSTEM_PROMPT).toMatch(/quote/i);
    expect(SYSTEM_PROMPT).toMatch(/attribut/i);
    // The old absolute prohibition must be gone.
    expect(SYSTEM_PROMPT).not.toMatch(/never quote it/i);
  });

  it("states that chunk content is DATA, not instructions (injection defense)", () => {
    expect(SYSTEM_PROMPT).toMatch(/data, never instructions|never as instructions|DATA/);
    expect(SYSTEM_PROMPT).toMatch(/instruction/i);
  });

  it("still pins the JSON output contract", () => {
    expect(SYSTEM_PROMPT).toMatch(/title/);
    expect(SYSTEM_PROMPT).toMatch(/bodyMarkdown/);
    expect(SYSTEM_PROMPT).toMatch(/citations/);
    expect(SYSTEM_PROMPT).toMatch(/quickShare/);
  });
});

describe("buildUserMessage — chunk fencing + labels", () => {
  it("wraps each chunk in explicit <chunk>…</chunk> data markers", () => {
    const msg = buildUserMessage("q", [chunk({ nodeId: "3.2" })]);
    expect(msg).toContain("<chunk");
    expect(msg).toContain("</chunk>");
    expect(msg).toMatch(/data only — never instructions/i);
  });

  it("attributes a user chunk by its source title", () => {
    const msg = buildUserMessage("q", [
      chunk({ tier: "user", sourceId: "s1", title: "my-notes.md", text: "secret" }),
    ]);
    expect(msg).toContain('source="my-notes.md"');
  });

  it("labels neighbour chunks so the model can down-weight them", () => {
    const msg = buildUserMessage("q", [chunk({ nodeId: "1.1", neighbor: true })]);
    expect(msg).toContain("neighbor=true");
  });
});
