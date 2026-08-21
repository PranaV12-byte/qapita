import type { Metadata } from "next";
import Breadcrumb from "@/components/article/Breadcrumb";
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
    };
  }).filter((article) => article.pillarSlug);

  return <PortalShell measure><Breadcrumb items={[{ label: "Wiki" }]} /><header className="mb-8 space-y-3"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--primary-purple)]">Published guidance</p><h1 className="font-head text-5xl text-[var(--text-head)]">Wiki</h1><p className="max-w-3xl text-lg leading-8 text-[var(--text-body)]">Read clear, practical guidance for the moments that matter in equity plan administration. Start here, then move to a draft when you are ready.</p></header><WikiIndex articles={view} /></PortalShell>;
}
