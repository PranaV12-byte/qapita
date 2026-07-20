import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildIndex, runSearch } from "@/lib/search/client";
import type { SearchDoc } from "@/lib/search/types";

const SAMPLE: SearchDoc[] = [
  {
    id: "a-1.1",
    type: "article",
    title: "Incentive stock options (ISOs)",
    path: "/a/awards/isos",
    pillar: "Award types & mechanics",
    summary: "ISOs can qualify for favorable tax treatment.",
    text: "Incentive stock options qualifying disposition AMT holding period.",
  },
  {
    id: "g-amt",
    type: "glossary",
    title: "Alternative minimum tax (AMT)",
    path: "/glossary/amt",
    summary: "A parallel tax system.",
    text: "AMT preference item on ISO exercise spread.",
  },
];

describe("Search index (client helpers)", () => {
  it("builds and searches by title", () => {
    const idx = buildIndex(SAMPLE);
    const hits = runSearch(idx, "incentive stock");
    expect(hits[0]?.path).toBe("/a/awards/isos");
  });

  it("matches glossary body text", () => {
    const idx = buildIndex(SAMPLE);
    const hits = runSearch(idx, "AMT");
    expect(hits.some((h) => h.path === "/glossary/amt")).toBe(true);
  });

  it("returns nothing for empty query", () => {
    const idx = buildIndex(SAMPLE);
    expect(runSearch(idx, "   ")).toHaveLength(0);
  });

  it("prefix search matches partial words", () => {
    const idx = buildIndex(SAMPLE);
    expect(runSearch(idx, "incent").length).toBeGreaterThan(0);
  });
});

describe("Prebuilt search-index.json", () => {
  const p = path.join(process.cwd(), "public", "search-index.json");

  it("exists and holds every article plus glossary terms", () => {
    expect(fs.existsSync(p)).toBe(true);
    const docs = JSON.parse(fs.readFileSync(p, "utf-8")) as SearchDoc[];
    const articles = docs.filter((d) => d.type === "article");
    const glossary = docs.filter((d) => d.type === "glossary");
    expect(articles).toHaveLength(41);
    expect(glossary.length).toBeGreaterThanOrEqual(40);
  });

  it("every doc has an id, title, and path", () => {
    const docs = JSON.parse(fs.readFileSync(p, "utf-8")) as SearchDoc[];
    docs.forEach((d) => {
      expect(d.id.length).toBeGreaterThan(0);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.path.startsWith("/")).toBe(true);
    });
  });
});
