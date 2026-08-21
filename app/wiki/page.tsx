import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import WikiIndex from "@/components/wiki/WikiIndex";
import { loadAllArticles } from "@/lib/content/loader";
import { PILLARS } from "@/lib/content/tree";

export const metadata: Metadata = {
  title: "Wiki - Q4N$P",
  description: "Published EquityIQ guidance organized by knowledge group.",
};

export default async function WikiPage() {
  const articles = await loadAllArticles();
  const view = articles.map((article) => {
    const pillar = PILLARS.find((item) => item.id === article.frontmatter.pillar);
    return {
      id: article.frontmatter.id,
      title: article.frontmatter.title,
      slug: article.frontmatter.slug,
      pillarSlug: pillar?.slug ?? "",
      pillarTitle: pillar?.title ?? "Knowledge Tree",
      summary: article.frontmatter.summaryPlain,
      searchText: article.content,
    };
  }).filter((article) => article.pillarSlug);

  return <PortalShell measure><header className="v9-wiki-heading"><h1>Wiki</h1><p>Read the guidance behind the work.</p></header><WikiIndex articles={view} /></PortalShell>;
}
