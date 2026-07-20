import { describe, it, expect } from "vitest";
import { SCENARIOS } from "@/lib/scenarios";
import { ALL_NODES } from "@/lib/content/tree";

// 1. Exactly 8 scenarios
describe("SCENARIOS array", () => {
  it("SCENARIOS.length === 8", () => {
    expect(SCENARIOS).toHaveLength(8);
  });

  // 2. Every scenario has required fields
  SCENARIOS.forEach((scenario) => {
    describe(`scenario "${scenario.id}"`, () => {
      it("id is a non-empty string", () => {
        expect(typeof scenario.id).toBe("string");
        expect(scenario.id.length).toBeGreaterThan(0);
      });

      it("label is at least 10 chars (full problem statement)", () => {
        expect(typeof scenario.label).toBe("string");
        expect(scenario.label.length).toBeGreaterThanOrEqual(10);
      });

      it("keywords is a non-empty array of strings", () => {
        expect(Array.isArray(scenario.keywords)).toBe(true);
        expect(scenario.keywords.length).toBeGreaterThan(0);
        scenario.keywords.forEach((k) => {
          expect(typeof k).toBe("string");
          expect(k.length).toBeGreaterThan(0);
        });
      });

      it("nodeIds is a non-empty array of strings", () => {
        expect(Array.isArray(scenario.nodeIds)).toBe(true);
        expect(scenario.nodeIds.length).toBeGreaterThan(0);
        scenario.nodeIds.forEach((n) => {
          expect(typeof n).toBe("string");
          expect(n.length).toBeGreaterThan(0);
        });
      });

      it("every nodeId exists in ALL_NODES", () => {
        const allIds = new Set(ALL_NODES.map((n) => n.id));
        scenario.nodeIds.forEach((nid) => {
          expect(allIds.has(nid), `nodeId "${nid}" not found in ALL_NODES`).toBe(true);
        });
      });
    });
  });

  // 3. Unique IDs
  it("all scenario IDs are unique", () => {
    const ids = SCENARIOS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  // 4. No canned artifacts
  it("scenarios do NOT have a cannedArtifact property", () => {
    SCENARIOS.forEach((s) => {
      expect(Object.prototype.hasOwnProperty.call(s, "cannedArtifact")).toBe(false);
    });
  });

  // Verify the exact 8 IDs expected by the spec
  it("contains all 8 expected scenario IDs", () => {
    const ids = SCENARIOS.map((s) => s.id);
    const expected = [
      "rsu-vesting-tax",
      "iso-exercise-amt",
      "espp-enrollment",
      "double-trigger-ipo",
      "post-termination",
      "10b5-1-blackouts",
      "83b-election",
      "year-end-reporting",
    ];
    expected.forEach((id) => {
      expect(ids).toContain(id);
    });
  });
});
