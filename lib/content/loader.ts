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

export async function loadArticle(
  pillarSlug: string,
  slug: string
): Promise<LoadedArticle | null> {
  const filePath = path.join(CONTENT_ROOT, pillarSlug, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = ArticleSchema.parse(data);
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

  return results;
}
