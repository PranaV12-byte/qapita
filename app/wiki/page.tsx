import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import WikiIndex from "@/components/wiki/WikiIndex";
import { loadAllArticles } from "@/lib/content/loader";
import { getNode, PILLARS } from "@/lib/content/tree";

export const metadata: Metadata = {
  title: "Wiki | EquityIQ",
  description: "Published EquityIQ guidance organized by knowledge group.",
};

export default async function WikiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const articles = await loadAllArticles();
  const view = articles.map((article) => {
    const pillar = PILLARS.find((item) => item.id === article.frontmatter.pillar);
    const node = getNode(article.frontmatter.id);
    if (!pillar || !node || node.pillarSlug !== pillar.slug) {
      throw new Error(`Article ${article.frontmatter.id} cannot resolve to a canonical Wiki route.`);
    }
    return {
      id: article.frontmatter.id,
      title: article.frontmatter.title,
      href: `/a/${node.pillarSlug}/${node.slug}`,
      pillarTitle: pillar.title,
      summary: article.frontmatter.summaryPlain,
      searchText: article.content,
    };
  });

  const { q } = await searchParams;
  return <PortalShell measure><header className="v9-wiki-heading"><h1>Wiki</h1></header><WikiIndex articles={view} initialQuery={q ?? ""} /></PortalShell>;
}
