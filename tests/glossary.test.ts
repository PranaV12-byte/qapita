import { describe, it, expect } from "vitest";
import { loadGlossary, getGlossaryTerm } from "@/lib/content/glossary";
import { getNode } from "@/lib/content/tree";

describe("Glossary", () => {
  const terms = loadGlossary();

  it("has at least 40 terms", () => {
    expect(terms.length).toBeGreaterThanOrEqual(40);
  });

  it("every term has a unique slug", () => {
    const slugs = terms.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("slugs are URL-safe (kebab-case)", () => {
    terms.forEach((t) => {
      expect(t.slug, t.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });
  });

  it("every term has a non-empty term and definition", () => {
    terms.forEach((t) => {
      expect(t.term.length).toBeGreaterThan(0);
      expect(t.definition.length).toBeGreaterThan(20);
    });
  });

  it("is sorted A–Z by term", () => {
    const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term));
    expect(terms.map((t) => t.term)).toEqual(sorted.map((t) => t.term));
  });

  it("every appearsIn id resolves to a real node", () => {
    terms.forEach((t) => {
      t.appearsIn.forEach((id) => {
        expect(getNode(id), `${t.slug} → ${id}`).toBeDefined();
      });
    });
  });

  it("definitions never reproduce commercial-source names", () => {
    terms.forEach((t) => {
      expect(t.definition.toLowerCase()).not.toContain("mystockoptions");
      expect(t.definition).not.toContain("NASPP");
    });
  });

  it("getGlossaryTerm returns the matching term", () => {
    const first = terms[0];
    expect(getGlossaryTerm(first.slug)?.term).toBe(first.term);
    expect(getGlossaryTerm("__nope__")).toBeUndefined();
  });
});
