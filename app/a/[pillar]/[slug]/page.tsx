import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import PortalShell from "@/components/portal/PortalShell";
import Breadcrumb from "@/components/article/Breadcrumb";
import StatusBadge from "@/components/article/StatusBadge";
import PlainLanguageCallout from "@/components/article/PlainLanguageCallout";
import Sources from "@/components/article/Sources";
import FaqAccordion from "@/components/article/FaqAccordion";
import RelatedNodes from "@/components/article/RelatedNodes";
import LensToggle from "@/components/lens/LensToggle";
import { mdxComponents } from "@/components/mdx/mdxComponents";
import { ALL_NODES, getPillar } from "@/lib/content/tree";
import { loadArticle } from "@/lib/content/loader";

type Params = { pillar: string; slug: string };

export function generateStaticParams() {
  return ALL_NODES.map((n) => ({ pillar: n.pillarSlug, slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pillar, slug } = await params;
  const article = await loadArticle(pillar, slug);
  return {
    title: article
      ? `${article.frontmatter.title} — Q4N$P`
      : "Not found — Q4N$P",
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
  const p = getPillar(pillar);

  return (
    <PortalShell measure>
      <Breadcrumb
        items={[
          { label: "Browse", href: "/browse" },
          ...(p ? [{ label: p.title, href: `/p/${p.slug}` }] : []),
          { label: frontmatter.title },
        ]}
      />

      <header className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <StatusBadge status={frontmatter.status} />
          <LensToggle />
        </div>
        <h1 className="font-serif text-heading text-3xl leading-tight mb-1">
          {frontmatter.title}
        </h1>
        <p className="text-xs text-[var(--text-muted)]">
          Updated {frontmatter.updatedAt}
        </p>
      </header>

      <PlainLanguageCallout text={frontmatter.summaryPlain} />

      <article>
        <MDXRemote source={content} components={mdxComponents} />
      </article>

      <Sources sources={frontmatter.sources} />
      <FaqAccordion faqs={frontmatter.faqs} />
      <RelatedNodes ids={frontmatter.related} />

      {/* CTA — generate a tailored artifact for this topic */}
      <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
        <h2 className="font-serif text-heading text-xl mb-1">
          Need this for a specific situation?
        </h2>
        <p className="text-sm text-[var(--text-body)] mb-4">
          Generate a tailored, share-ready explanation grounded in this topic.
        </p>
        <Link
          href={`/generate?nodeId=${frontmatter.id}`}
          className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-on)] text-sm font-medium"
          style={{ textDecoration: "none" }}
        >
          Generate an artifact →
        </Link>
      </div>
    </PortalShell>
  );
}
