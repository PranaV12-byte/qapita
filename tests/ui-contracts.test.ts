import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(resolve(root, ...parts), "utf8");

describe("restored UI contracts", () => {
  it("keeps all successful-answer side cards and accessible related-topic fallback", () => {
    const source = read("components", "ArtifactResult.tsx");
    expect(source).toContain('title="Related topics"');
    expect(source).toContain('title="Actions"');
    expect(source).toContain("v9-related-topics-empty");
    expect(source).toContain('Browse the Knowledge Tree');
    expect(source).toContain("v9-action-button");
  });

  it("keeps Wiki search labelled only as Search the Wiki", () => {
    const source = read("components", "wiki", "WikiIndex.tsx");
    expect(source).toContain('aria-label="Search the Wiki"');
    expect(source).toContain('placeholder="Search the Wiki"');
    expect(source).not.toContain("Search Wiki articles");
  });

  it("keeps the article breadcrumb and static article panels addressable", () => {
    const article = read("app", "a", "[pillar]", "[slug]", "page.tsx");
    const breadcrumb = read("components", "article", "Breadcrumb.tsx");
    const faq = read("components", "article", "FaqAccordion.tsx");
    expect(article).toContain('label: "Knowledge Tree", href: "/browse"');
    expect(article).toContain("v9-article-back");
    expect(breadcrumb).toContain("v9-breadcrumb-link");
    expect(faq).toContain("useState<number | null>(null)");
  });

  it("defaults the Brain narrow-screen tab to Graph and scopes its controls", () => {
    const client = read("app", "brain", "client.tsx");
    const stats = read("components", "brain", "BrainStats.tsx");
    const css = read("app", "globals.css");
    expect(client).toContain('useState<"sources" | "graph">("graph")');
    expect(stats).toContain("v9-brain-stats-grid");
    expect(stats).toContain("v9-brain-stat-value");
    expect(css).toContain("@media (max-width: 1024px)");
    expect(css).toContain(".v9-brain-mobile-tabs button");
    expect(css).toContain(".v9-brain-graph.is-visible");
  });

  it("keeps the Knowledge Tree as one row-aware responsive implementation", () => {
    const source = read("components", "knowledge", "KnowledgeCenter.tsx");
    const css = read("app", "globals.css");
    expect(source).toContain("v9-pillar-detail-slot");
    expect(source).toContain("--detail-row-desktop");
    expect(css).toContain("grid-row: var(--detail-row-desktop)");
    expect(css).toContain("grid-row: var(--detail-row-tablet)");
    expect(css).toContain("grid-row: var(--detail-row-mobile)");
  });
});
