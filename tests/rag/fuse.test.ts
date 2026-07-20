import { describe, it, expect } from "vitest";
import { rrfFuse } from "@/lib/rag/lexical";

describe("rrfFuse", () => {
  it("rank-1 in both lists scores highest", () => {
    const dense = [10, 20, 30];
    const lexical = [10, 40, 50];
    const fused = rrfFuse([dense, lexical], 60);
    // id 10 is rank 1 in both → 1/61 + 1/61
    const expected10 = 1 / 61 + 1 / 61;
    expect(fused.get(10)).toBeCloseTo(expected10, 10);
    // 10 must outrank every id that appears in only one list.
    const others = [20, 30, 40, 50].map((id) => fused.get(id)!);
    others.forEach((s) => expect(fused.get(10)!).toBeGreaterThan(s));
  });

  it("an item present in both lists beats one present in a single list at a better rank", () => {
    // id 1: rank2 dense + rank3 lexical. id 2: rank1 dense only.
    const dense = [2, 1, 99];
    const lexical = [98, 97, 1];
    const fused = rrfFuse([dense, lexical], 60);
    const s1 = fused.get(1)!; // 1/62 + 1/63
    const s2 = fused.get(2)!; // 1/61
    expect(s1).toBeGreaterThan(s2);
  });

  it("higher rank (earlier position) yields a higher contribution", () => {
    const fused = rrfFuse([[7, 8]], 60);
    expect(fused.get(7)!).toBeGreaterThan(fused.get(8)!);
  });

  it("empty lists produce an empty map", () => {
    expect(rrfFuse([]).size).toBe(0);
    expect(rrfFuse([[], []]).size).toBe(0);
  });
});
