import { describe, expect, it } from "vitest";
import { ALL_NODES } from "../lib/content/tree";
import {
  LEGACY_TO_V9_TOPIC,
  V9_ACTIVE_SUBTOPICS,
  V9_SUBTOPICS,
  V9_TAXONOMY,
  getV9Subtopic,
  primaryLegacyTopicId,
} from "../lib/content/v9-taxonomy";

describe("V9 taxonomy compatibility", () => {
  it("keeps the approved group and active topic counts", () => {
    expect(V9_TAXONOMY).toHaveLength(9);
    expect(V9_ACTIVE_SUBTOPICS).toHaveLength(52);
    expect(V9_SUBTOPICS).toHaveLength(56);
  });

  it("maps every legacy topic to one valid V9 subtopic", () => {
    expect(Object.keys(LEGACY_TO_V9_TOPIC)).toHaveLength(ALL_NODES.length);
    for (const node of ALL_NODES) {
      const v9Id = LEGACY_TO_V9_TOPIC[node.id];
      expect(getV9Subtopic(v9Id)).toBeDefined();
      expect(primaryLegacyTopicId(v9Id)).toBeDefined();
    }
  });
});
