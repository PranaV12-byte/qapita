import { describe, expect, it } from "vitest";
import { canDeliverGeneratedAnswer } from "../lib/generate-utils";

describe("generated answer delivery guard", () => {
  it("allows current answers and backward-compatible responses", () => {
    expect(canDeliverGeneratedAnswer(true)).toBe(true);
    expect(canDeliverGeneratedAnswer(undefined)).toBe(true);
  });

  it("blocks delivery for a deliberate no-answer response", () => {
    expect(canDeliverGeneratedAnswer(false)).toBe(false);
  });
});
