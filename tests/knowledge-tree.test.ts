import { describe, expect, it } from "vitest";
import { loadKnowledgeTree } from "../lib/content/knowledge-tree";
import { V9_TAXONOMY } from "../lib/content/v9-taxonomy";
import { loadAllArticles } from "../lib/content/loader";

describe("Knowledge Tree content view", () => {
  it("keeps the complete taxonomy visible", () => {
    expect(V9_TAXONOMY).toHaveLength(9);
    expect(V9_TAXONOMY.flatMap((group) => group.subtopics)).toHaveLength(56);
    expect(V9_TAXONOMY.flatMap((group) => group.subtopics).flatMap((topic) => topic.leaves)).toHaveLength(388);
  });

  it("links every reviewed article and marks unsupported leaves for preparation", async () => {
    const [tree, articles] = await Promise.all([loadKnowledgeTree(), loadAllArticles()]);
    const linkedIds = new Set(tree.flatMap((group) => group.subtopics.flatMap((topic) => topic.articles.map((article) => article.id))));
    expect(articles).toHaveLength(41);
    expect(linkedIds).toEqual(new Set(articles.map((article) => article.frontmatter.id)));
    expect(tree.flatMap((group) => group.subtopics).flatMap((topic) => topic.leaves).some((leaf) => leaf.status === "preparation")).toBe(true);
    expect(tree.flatMap((group) => group.subtopics).flatMap((topic) => topic.leaves.filter((leaf) => leaf.status === "preparation" && leaf.href))).toHaveLength(0);
  });

  it("uses canonical routes for the reported Wiki articles", async () => {
    const tree = await loadKnowledgeTree();
    const articles = tree.flatMap((group) => group.subtopics.flatMap((topic) => topic.articles));
    const byId = new Map(articles.map((article) => [article.id, article.href]));
    expect(new Set(articles.map((article) => article.id)).size).toBe(articles.length);
    expect(new Set(articles.map((article) => article.href)).size).toBe(articles.length);
    expect(byId.get("2.2")).toBe("/a/lifecycle/vesting");
    expect(byId.get("2.3")).toBe("/a/lifecycle/exercise");
    expect(byId.get("4.3")).toBe("/a/accounting/modifications");
  });
});
