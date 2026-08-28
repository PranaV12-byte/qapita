import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, buildUserMessage } from "../lib/llm/prompt";
import type { RetrievalChunk } from "../lib/rag/types";

const chunk: RetrievalChunk = {
  tier: "user",
  sourceId: "source-1",
  title: "Private employee note.docx",
  nodeId: "u-private-note",
  text: "A private note about an employee option grant.",
  score: 1,
  cosine: 1,
};

describe("generated answer prompt policy", () => {
  it("forbids external attribution and inline citation markers", () => {
    expect(SYSTEM_PROMPT).toContain("Do not quote or cite any external source by name");
    expect(SYSTEM_PROMPT).toContain("Never mention NASPP or MyStockOptions in generated prose");
    expect(SYSTEM_PROMPT).toContain("Do not emit inline citation markers");
    expect(SYSTEM_PROMPT).toContain("Return citation identifiers only in the structured citations array");
  });

  it("passes neutral origins and structured IDs without uploaded filenames", () => {
    const message = buildUserMessage("What is this?", [chunk]);
    expect(message).toContain("origin=user-upload");
    expect(message).toContain('sourceId="source-1"');
    expect(message).not.toContain("Private employee note.docx");
  });

  it("requests structured comparison data for comparison format", () => {
    const message = buildUserMessage("What is the difference between ISOs and NSOs?", [chunk], "comparison");
    expect(message).toContain("Return structured comparison data");
    expect(message).toContain("two to four topic columns");
    expect(message).toContain("do not return a markdown pipe table");
  });

  it("keeps email generation focused on content owned by the branded template", () => {
    const message = buildUserMessage("How are ISOs taxed?", [chunk], "email");
    expect(message).toContain("Format only the grounded answer content for insertion into a branded email template");
    expect(message).toContain("Do not include a subject line, greeting, sign-off, footer, or email framing");
  });
});
