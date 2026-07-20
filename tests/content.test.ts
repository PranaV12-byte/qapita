import { describe, it, expect } from "vitest";
import { PILLARS, ALL_NODES, getNode, getPillar } from "@/lib/content/tree";
import { ArticleSchema } from "@/lib/content/schema";
import { loadAllArticles } from "@/lib/content/loader";
import { z } from "zod";

// 1. Tree manifest completeness
describe("Tree manifest completeness", () => {
  it("PILLARS has exactly 7 entries", () => {
    expect(PILLARS).toHaveLength(7);
  });

  it("ALL_NODES has exactly 41 entries", () => {
    expect(ALL_NODES).toHaveLength(41);
  });

  it("every node has a unique id", () => {
    const ids = ALL_NODES.map((n) => n.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every node has a unique slug", () => {
    const slugs = ALL_NODES.map((n) => n.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("every node has a non-empty title", () => {
    ALL_NODES.forEach((n) => {
      expect(n.title.length).toBeGreaterThan(0);
    });
  });

  it("every node has a non-empty pillarSlug", () => {
    ALL_NODES.forEach((n) => {
      expect(n.pillarSlug.length).toBeGreaterThan(0);
    });
  });

  it("getNode('1.1') returns the ISOs node", () => {
    const node = getNode("1.1");
    expect(node).toBeDefined();
    expect(node!.slug).toBe("isos");
    expect(node!.pillar).toBe(1);
  });

  it("getNode('99.9') returns undefined", () => {
    expect(getNode("99.9")).toBeUndefined();
  });

  it("getPillar('awards') returns pillar 1 with 7 nodes", () => {
    const pillar = getPillar("awards");
    expect(pillar).toBeDefined();
    expect(pillar!.id).toBe(1);
    expect(pillar!.nodes).toHaveLength(7);
  });

  it("getPillar('nonexistent') returns undefined", () => {
    expect(getPillar("nonexistent")).toBeUndefined();
  });

  it("pillar slugs are exactly: awards, lifecycle, tax, accounting, securities-law, plan-design, admin-ops", () => {
    const slugs = PILLARS.map((p) => p.slug);
    expect(slugs).toEqual([
      "awards",
      "lifecycle",
      "tax",
      "accounting",
      "securities-law",
      "plan-design",
      "admin-ops",
    ]);
  });
});

// 2. Zod schema rejects bad frontmatter
describe("Zod schema validation", () => {
  const valid = {
    id: "1.1",
    pillar: 1,
    slug: "isos",
    title: "Test",
    status: "generated" as const,
    audience: ["admin" as const],
    summaryPlain: "",
    sources: [{ label: "IRC § 422" }],
    reviewedBy: null,
    faqs: [{ q: "Q?", a: "A." }, { q: "Q2?", a: "A2." }, { q: "Q3?", a: "A3." }],
    updatedAt: "2026-07-12",
    related: ["1.2"],
  };

  it("valid frontmatter passes without error", () => {
    expect(() => ArticleSchema.parse(valid)).not.toThrow();
  });

  it("missing title throws ZodError", () => {
    const bad = { ...valid, title: undefined };
    expect(() => ArticleSchema.parse(bad)).toThrow(z.ZodError);
  });

  it("invalid status 'reviewed' throws", () => {
    const bad = { ...valid, status: "reviewed" };
    expect(() => ArticleSchema.parse(bad)).toThrow(z.ZodError);
  });

  it("invalid audience 'manager' throws", () => {
    const bad = { ...valid, audience: ["manager"] };
    expect(() => ArticleSchema.parse(bad)).toThrow(z.ZodError);
  });

  it("pillar: 0 throws (min 1)", () => {
    const bad = { ...valid, pillar: 0 };
    expect(() => ArticleSchema.parse(bad)).toThrow(z.ZodError);
  });

  it("pillar: 8 throws (max 7)", () => {
    const bad = { ...valid, pillar: 8 };
    expect(() => ArticleSchema.parse(bad)).toThrow(z.ZodError);
  });
});

// 3-6: Content loader tests (require MDX files on disk)
describe("Content loader and article quality", () => {
  let articles: Awaited<ReturnType<typeof loadAllArticles>>;

  // Load articles once for all sub-tests
  async function getArticles() {
    if (!articles) {
      articles = await loadAllArticles();
    }
    return articles;
  }

  it("loadAllArticles() returns exactly 12 items", async () => {
    const loaded = await getArticles();
    expect(loaded).toHaveLength(12);
  });

  it("each article has valid frontmatter (passes Zod)", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      expect(() => ArticleSchema.parse(frontmatter)).not.toThrow();
    });
  });

  it("each article has non-empty content (body text > 500 chars)", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter, content }) => {
      expect(content.length).toBeGreaterThan(500);
    });
  });

  it("no duplicate IDs across articles", async () => {
    const loaded = await getArticles();
    const ids = loaded.map(({ frontmatter }) => frontmatter.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  // 4. Content loader validates every article against schema
  it("every article has status === 'generated'", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      expect(frontmatter.status).toBe("generated");
    });
  });

  it("every article has reviewedBy === null", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      expect(frontmatter.reviewedBy).toBeNull();
    });
  });

  it("every article has exactly 3 FAQs", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      expect(frontmatter.faqs).toHaveLength(3);
    });
  });

  it("every FAQ has non-empty q and a strings", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      frontmatter.faqs.forEach((faq) => {
        expect(faq.q.length).toBeGreaterThan(0);
        expect(faq.a.length).toBeGreaterThan(0);
      });
    });
  });

  it("every article has at least 1 source with non-empty label", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      expect(frontmatter.sources.length).toBeGreaterThanOrEqual(1);
      frontmatter.sources.forEach((source) => {
        expect(source.label.length).toBeGreaterThan(0);
      });
    });
  });

  it("every article has at least 1 related entry", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      expect(frontmatter.related.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("every related ID exists in ALL_NODES (no broken references)", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      frontmatter.related.forEach((relId) => {
        const node = getNode(relId);
        expect(node, `related ID "${relId}" in article "${frontmatter.id}" not found in ALL_NODES`).toBeDefined();
      });
    });
  });

  it("every article's audience includes at least one valid value", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      expect(frontmatter.audience.length).toBeGreaterThanOrEqual(1);
    });
  });

  // 5. Content quality checks
  it("body content is between 800-1200 words", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter, content }) => {
      const wordCount = content.trim().split(/\s+/).length;
      expect(wordCount, `Article "${frontmatter.id}" has ${wordCount} words (expected 800-1200)`).toBeGreaterThanOrEqual(800);
      expect(wordCount, `Article "${frontmatter.id}" has ${wordCount} words (expected 800-1200)`).toBeLessThanOrEqual(1200);
    });
  });

  it("body does not contain 'lorem ipsum' (case-insensitive)", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter, content }) => {
      expect(content.toLowerCase(), `Article "${frontmatter.id}" contains 'lorem ipsum'`).not.toContain("lorem ipsum");
    });
  });

  it("body does not contain 'TODO' or 'FIXME'", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter, content }) => {
      expect(content, `Article "${frontmatter.id}" contains TODO`).not.toContain("TODO");
      expect(content, `Article "${frontmatter.id}" contains FIXME`).not.toContain("FIXME");
    });
  });

  it("body does not contain 'myStockOptions' or 'mystockoptions'", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter, content }) => {
      expect(content.toLowerCase(), `Article "${frontmatter.id}" mentions myStockOptions`).not.toContain("mystockoptions");
    });
  });

  it("body does not contain 'NASPP'", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter, content }) => {
      expect(content, `Article "${frontmatter.id}" contains NASPP`).not.toContain("NASPP");
    });
  });

  // 6. Article-to-tree consistency
  it("every article's frontmatter.id exists in ALL_NODES", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      const node = getNode(frontmatter.id);
      expect(node, `Article id "${frontmatter.id}" not found in ALL_NODES`).toBeDefined();
    });
  });

  it("every article's pillar matches its tree node's pillar", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      const node = getNode(frontmatter.id)!;
      expect(frontmatter.pillar, `Article "${frontmatter.id}" pillar mismatch`).toBe(node.pillar);
    });
  });

  it("every article's slug matches its tree node's slug", async () => {
    const loaded = await getArticles();
    loaded.forEach(({ frontmatter }) => {
      const node = getNode(frontmatter.id)!;
      expect(frontmatter.slug, `Article "${frontmatter.id}" slug mismatch`).toBe(node.slug);
    });
  });
});
