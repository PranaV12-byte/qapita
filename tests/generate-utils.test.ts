import { describe, expect, it } from "vitest";
import { buildArtifactCopyText, canDeliverGeneratedAnswer } from "../lib/generate-utils";

describe("generated answer delivery guard", () => {
  it("allows current answers and backward-compatible responses", () => {
    expect(canDeliverGeneratedAnswer(true)).toBe(true);
    expect(canDeliverGeneratedAnswer(undefined)).toBe(true);
  });

  it("blocks delivery for a deliberate no-answer response", () => {
    expect(canDeliverGeneratedAnswer(false)).toBe(false);
  });
});

describe("artifact clipboard text", () => {
  it("copies the complete question and complete answer without the short-share cap", () => {
    const body = [
      "## Overview",
      "**ISOs** are employee stock options.",
      "",
      "- Holding periods can affect the tax outcome.",
      "",
      "## Timing",
      "More than 240 words are not required for this regression, but every displayed block remains part of the copied text.",
    ].join("\n");
    const copied = buildArtifactCopyText("What is an ISO?", body);

    expect(copied).toBe("What is an ISO?\n\nOverview\nISOs are employee stock options.\n\n- Holding periods can affect the tax outcome.\n\nTiming\nMore than 240 words are not required for this regression, but every displayed block remains part of the copied text.");
  });

  it("removes only an exact leading question echo from the answer", () => {
    const copied = buildArtifactCopyText("What is an ISO?", "What is an ISO?\n\nAn ISO is an employee stock option.");
    expect(copied).toBe("What is an ISO?\n\nAn ISO is an employee stock option.");
  });
});
