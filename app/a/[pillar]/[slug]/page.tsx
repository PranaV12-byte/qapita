import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Breadcrumb from "@/components/article/Breadcrumb";
import FaqAccordion from "@/components/article/FaqAccordion";
import PlainLanguageCallout from "@/components/article/PlainLanguageCallout";
import RelatedNodes from "@/components/article/RelatedNodes";
import Sources from "@/components/article/Sources";
import { mdxComponents } from "@/components/mdx/mdxComponents";
import PortalShell from "@/components/portal/PortalShell";
import { loadArticle } from "@/lib/content/loader";
import { ALL_NODES, getPillar } from "@/lib/content/tree";

type Params = { pillar: string; slug: string };

export function generateStaticParams() {
  return ALL_NODES
    .filter((node) => node.contentState !== "planned")
    .map((node) => ({ pillar: node.pillarSlug, slug: node.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pillar, slug } = await params;
  const article = await loadArticle(pillar, slug);
  return {
    title: article ? `${article.frontmatter.title} | EquityIQ` : "Not found | EquityIQ",
    description: article?.frontmatter.summaryPlain,
    robots: "noindex",
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { pillar, slug } = await params;
  const article = await loadArticle(pillar, slug);
  if (!article) notFound();

  const { frontmatter, content } = article;
  const resolvedPillar = getPillar(pillar);

  return (
    <PortalShell measure>
      <Breadcrumb
        items={[
          { label: "Knowledge Tree", href: "/browse" },
          ...(resolvedPillar
            ? [{ label: resolvedPillar.title, href: `/p/${resolvedPillar.slug}` }]
            : []),
          { label: frontmatter.title },
        ]}
      />

      <header className="v9-article-heading">
        <span className="v9-article-tag">{resolvedPillar?.title ?? "Wiki"}</span>
        <h1>{frontmatter.title}</h1>
      </header>

      {resolvedPillar && (
        <Link href={`/p/${resolvedPillar.slug}`} className="mb-6 inline-flex text-sm font-semibold text-[var(--primary-purple)]" style={{ textDecoration: "none" }}>
          <span aria-hidden="true" className="mr-2">←</span> Back to {resolvedPillar.title} in Knowledge Tree
        </Link>
      )}

      <div className="v9-article-short-answer"><span>Short answer</span><PlainLanguageCallout text={frontmatter.summaryPlain} /></div>

      <div className="v9-article-layout">
        <article className="v9-article-body">
          <MDXRemote source={content} components={mdxComponents} />
        </article>

        <aside className="v9-article-aside">
          <div className="v9-article-panel">
            <FaqAccordion faqs={frontmatter.faqs} />
          </div>
          <div className="v9-article-panel v9-article-draft-panel">
            <h2>Need this for a specific situation?</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--text-body)]">Generate a ready-to-share answer grounded in this article.</p>
            <Link
              href={`/generate?nodeId=${frontmatter.id}`}
              className="v9-primary-button mt-4"
              style={{ textDecoration: "none" }}
            >
              Generate a draft
            </Link>
          </div>
          <div className="v9-article-panel">
            <Sources sources={frontmatter.sources} />
          </div>
          <div className="v9-article-panel">
            <RelatedNodes ids={frontmatter.related} />
          </div>
        </aside>
      </div>
    </PortalShell>
  );
}
