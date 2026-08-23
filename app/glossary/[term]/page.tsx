import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/article/Breadcrumb";
import PortalShell from "@/components/portal/PortalShell";
import { getGlossaryTerm, loadGlossary } from "@/lib/content/glossary";
import { getNode } from "@/lib/content/tree";

type Params = { term: string };

export function generateStaticParams() {
  return loadGlossary().map((term) => ({ term: term.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { term } = await params;
  const resolved = getGlossaryTerm(term);
  return {
    title: resolved ? `${resolved.term} | EquityIQ` : "Not found | EquityIQ",
    description: resolved?.definition,
    robots: "noindex",
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { term } = await params;
  const resolved = getGlossaryTerm(term);
  if (!resolved) notFound();

  const nodes = resolved.appearsIn
    .map(getNode)
    .filter((node): node is NonNullable<typeof node> => Boolean(node));

  return (
    <PortalShell measure>
      <Breadcrumb
        items={[
          { label: "Knowledge tree", href: "/browse" },
          { label: "Glossary", href: "/glossary" },
          { label: resolved.term },
        ]}
      />

      <section className="q-shell-card p-6 md:p-8">
        <h1 className="font-head text-5xl text-[var(--text-head)]">
          {resolved.term}
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--text-body)]">
          {resolved.definition}
        </p>

        {nodes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Appears in
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {nodes.map((node) => (
                <Link
                  key={node.id}
                  href={`/a/${node.pillarSlug}/${node.slug}`}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{ textDecoration: "none" }}
                >
                  {node.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
