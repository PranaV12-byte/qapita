import { afterEach, describe, expect, it } from "vitest";
import type { RetrievalChunk } from "../lib/rag/types";
import { selectAnswerGrounding } from "../lib/llm/grounding";
import { MockLLM } from "../lib/llm/mock";
import { getQueryIntent } from "../lib/llm/query-intent";

const overview: RetrievalChunk = {
  tier: "curated",
  nodeId: "1.1",
  title: "Incentive stock options (ISOs)",
  headingPath: "Overview",
  parentId: "article:1.1#summary",
  sectionKind: "summary",
  text: "Incentive stock options (ISOs) are a type of employee stock option that can qualify for favorable tax treatment under IRC Section 422. Unlike NSOs, ISOs generate no ordinary income at exercise.",
  parentText: "Incentive stock options (ISOs) are a type of employee stock option that can qualify for favorable tax treatment under IRC Section 422. Unlike NSOs, ISOs generate no ordinary income at exercise.",
  score: 0.8,
  cosine: 0.8,
};

const amtDetail: RetrievalChunk = {
  tier: "curated",
  nodeId: "1.1",
  title: "Incentive stock options (ISOs)",
  headingPath: "Incentive stock options (ISOs) > The AMT complication",
  parentId: "article:1.1#amt",
  text: "When an employee exercises an ISO and holds the shares, the spread at exercise is an AMT preference item.",
  parentText: "When an employee exercises an ISO and holds the shares, the spread at exercise is an AMT preference item.",
  score: 0.9,
  cosine: 0.9,
};

describe("definition grounding", () => {
  afterEach(() => {
    delete process.env.MOCK_DELAY;
  });

  it("prefers canonical overview evidence over an incidental tax detail", () => {
    const query = "What is an ISO?";
    const intent = getQueryIntent(query);
    const selection = selectAnswerGrounding(query, [amtDetail, overview], { intent });

    expect(intent).toMatchObject({ kind: "definition", nodeId: "1.1" });
    expect(selection.answerable).toBe(true);
    expect(selection.chunks[0]).toBe(overview);
  });

  it("produces a definition-first Mock answer from the same filtered grounding", async () => {
    process.env.MOCK_DELAY = "false";
    const query = "What is an ISO?";
    const intent = getQueryIntent(query);
    const selection = selectAnswerGrounding(query, [amtDetail, overview], { intent });
    const answer = await new MockLLM().generate(query, selection.chunks, { queryIntent: intent });

    expect(answer.title).toBe("Incentive stock options (ISOs)");
    expect(answer.bodyMarkdown).toContain("a type of employee stock option");
    expect(answer.bodyMarkdown).not.toBe("When an employee exercises an ISO and holds the shares, the spread at exercise is an AMT preference item.");
  });

});
