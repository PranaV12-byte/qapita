import { articleExists, loadAllArticles } from "./loader";
import { getNode } from "./tree";
import {
  LEGACY_TO_V9_TOPIC,
  V9_TAXONOMY,
  legacyTopicIdsForV9,
} from "./v9-taxonomy";

export type KnowledgeArticle = {
  id: string;
  title: string;
  href: string;
};

export type KnowledgeLeaf = {
  name: string;
  status: "published" | "preparation";
  href?: string;
};

export type KnowledgeSubtopic = {
  id: string;
  name: string;
  comingSoon?: boolean;
  status: "published" | "preparation";
  articles: KnowledgeArticle[];
  leaves: KnowledgeLeaf[];
};

export type KnowledgeGroup = {
  id: string;
  name: string;
  icon: string;
  color: string;
  comingSoon?: boolean;
  status: "published" | "preparation";
  subtopics: KnowledgeSubtopic[];
};

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Builds the client-safe Knowledge Tree view from the approved V9 taxonomy and
 * the reviewed MDX corpus. Only exact article IDs and exact article titles can
 * create published links; everything else remains visible as preparation.
 */
export async function loadKnowledgeTree(): Promise<KnowledgeGroup[]> {
  const articles = await loadAllArticles();
  const articlesById = new Map(
    articles.map((article) => {
      const node = getNode(article.frontmatter.id);
      if (!node || !articleExists(node.pillarSlug, node.slug)) {
        throw new Error(`Published article ${article.frontmatter.id} has no canonical tree node.`);
      }
      return [article.frontmatter.id, {
        id: article.frontmatter.id,
        title: article.frontmatter.title,
        href: `/a/${node.pillarSlug}/${node.slug}`,
      } satisfies KnowledgeArticle];
    })
  );
  const articlesByTitle = new Map(
    [...articlesById.values()].map((article) => [normalizeLabel(article.title), article])
  );

  return V9_TAXONOMY.map((group) => ({
    id: group.id,
    name: group.name,
    icon: group.icon,
    color: group.color,
    comingSoon: group.comingSoon,
    status: group.comingSoon ? "preparation" : "published",
    subtopics: group.subtopics.map((topic) => {
      const topicArticles = group.comingSoon
        ? []
        : legacyTopicIdsForV9(topic.id)
          .map((legacyId) => articlesById.get(legacyId))
          .filter((article): article is KnowledgeArticle => !!article);
      const uniqueArticles = [...new Map(topicArticles.map((article) => [article.id, article])).values()];
      return {
        id: topic.id,
        name: topic.name,
        comingSoon: topic.comingSoon,
        status: uniqueArticles.length > 0 ? "published" : "preparation",
        articles: uniqueArticles,
        leaves: topic.leaves.map((leaf) => {
          const exactArticle = articlesByTitle.get(normalizeLabel(leaf.name));
          return exactArticle
            ? { name: leaf.name, status: "published", href: exactArticle.href }
            : { name: leaf.name, status: "preparation" };
        }),
      } satisfies KnowledgeSubtopic;
    }),
  } satisfies KnowledgeGroup));
}

export function assertKnowledgeTreeMapping(tree: KnowledgeGroup[], expectedArticleIds: string[]): void {
  const linkedIds = new Set(
    tree.flatMap((group) => group.subtopics.flatMap((topic) => topic.articles.map((article) => article.id)))
  );
  for (const id of expectedArticleIds) {
    if (!linkedIds.has(id)) throw new Error(`Published article ${id} is unreachable from the Knowledge Tree.`);
  }
  for (const legacyId of Object.keys(LEGACY_TO_V9_TOPIC)) {
    if (!getNode(legacyId)) throw new Error(`Knowledge Tree mapping references unknown article ${legacyId}.`);
  }
}
