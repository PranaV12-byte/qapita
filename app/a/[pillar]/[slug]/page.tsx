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
  return ALL_NODES.map((node) => ({ pillar: node.pillarSlug, slug: node.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pillar, slug } = await params;
  const article = await loadArticle(pillar, slug);
  return {
    title: article ? `${article.frontmatter.title} - Q4N$P` : "Not found - Q4N$P",
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
  const reviewed = frontmatter.status === "signed_off";

  return (
    <PortalShell measure>
      <Breadcrumb
        items={[
          { label: "Knowledge tree", href: "/browse" },
          ...(resolvedPillar
            ? [{ label: resolvedPillar.title, href: `/p/${resolvedPillar.slug}` }]
            : []),
          { label: frontmatter.title },
        ]}
      />

      <header className="mb-8 space-y-4">
        <h1 className="font-head text-5xl leading-tight text-[var(--text-head)]">
          {frontmatter.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold"
            style={{
              backgroundColor: reviewed ? "#eefaf2" : "#fff3eb",
              color: reviewed ? "#22a84f" : "#e67a22",
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: reviewed ? "#22b45a" : "#f28c38" }}
            />
            {reviewed ? "Reviewed and signed off" : "Draft reference"}
          </span>
          <span>Last updated {frontmatter.updatedAt}</span>
        </div>
      </header>

      <PlainLanguageCallout text={frontmatter.summaryPlain} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_380px]">
        <article className="space-y-8 rounded-[24px] border border-[var(--border)] bg-white px-6 py-7 md:px-8">
          <MDXRemote source={content} components={mdxComponents} />
        </article>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-[var(--border)] bg-white p-5">
            <FaqAccordion faqs={frontmatter.faqs} />
          </div>
          <div className="rounded-[24px] border border-[var(--border)] bg-white p-5">
            <h2 className="font-head text-2xl text-[var(--text-head)]">
              Need this for a specific situation?
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--text-body)]">
              Prepare a draft grounded in this topic and ready for internal review.
            </p>
            <Link
              href={`/generate?nodeId=${frontmatter.id}`}
              className="mt-4 inline-flex min-h-[48px] items-center rounded-xl bg-[var(--accent-solid)] px-5 text-sm font-semibold text-white"
              style={{ textDecoration: "none" }}
            >
              Generate a draft
            </Link>
          </div>
          <div className="rounded-[24px] border border-[var(--border)] bg-white p-5">
            <Sources sources={frontmatter.sources} />
          </div>
          <div className="rounded-[24px] border border-[var(--border)] bg-white p-5">
            <RelatedNodes ids={frontmatter.related} />
          </div>
        </aside>
      </div>
    </PortalShell>
  );
}
