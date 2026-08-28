import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { ArticleSchema, type Article } from "./schema";
import { PILLARS } from "./tree";

const CONTENT_ROOT = path.join(process.cwd(), "content", "pillars");

export type LoadedArticle = {
  frontmatter: Article;
  content: string;
};

// MDX frontmatter is content-authored, while taxonomy routes are application
// owned. This check prevents a valid-looking article from claiming another
// article's route or introducing a duplicate public URL.
function canonicalNodeForArticle(article: Article) {
  const pillar = PILLARS.find((item) => item.id === article.pillar);
  const node = pillar?.nodes.find((item) => item.id === article.id);
  if (!pillar || !node || node.slug !== article.slug || node.pillarSlug !== pillar.slug) {
    throw new Error(`Article ${article.id} does not match a canonical taxonomy route.`);
  }
  return node;
}

function validateArticleCollection(articles: LoadedArticle[]): LoadedArticle[] {
  const ids = new Set<string>();
  const routes = new Set<string>();
  for (const article of articles) {
    const node = canonicalNodeForArticle(article.frontmatter);
    if (ids.has(article.frontmatter.id)) {
      throw new Error(`Duplicate article id ${article.frontmatter.id}.`);
    }
    ids.add(article.frontmatter.id);

    const route = `/a/${node.pillarSlug}/${node.slug}`;
    if (routes.has(route)) throw new Error(`Duplicate canonical article route ${route}.`);
    routes.add(route);
  }
  return articles;
}

export async function loadArticle(
  pillarSlug: string,
  slug: string
): Promise<LoadedArticle | null> {
  const filePath = path.join(CONTENT_ROOT, pillarSlug, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = ArticleSchema.parse(data);
  canonicalNodeForArticle(frontmatter);
  return { frontmatter, content };
}

/** True if a published MDX article exists for this pillar/slug. */
export function articleExists(pillarSlug: string, slug: string): boolean {
  return fs.existsSync(path.join(CONTENT_ROOT, pillarSlug, `${slug}.mdx`));
}

export async function loadAllArticles(): Promise<LoadedArticle[]> {
  const results: LoadedArticle[] = [];

  for (const pillar of PILLARS) {
    const pillarDir = path.join(CONTENT_ROOT, pillar.slug);
    if (!fs.existsSync(pillarDir)) continue;

    for (const node of pillar.nodes) {
      const filePath = path.join(pillarDir, `${node.slug}.mdx`);
      if (!fs.existsSync(filePath)) continue;

      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);
      const frontmatter = ArticleSchema.parse(data);
      results.push({ frontmatter, content });
    }
  }

  return validateArticleCollection(results);
}
