import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import Breadcrumb from "@/components/article/Breadcrumb";
import { loadGlossary, getGlossaryTerm } from "@/lib/content/glossary";
import { getNode } from "@/lib/content/tree";

type Params = { term: string };

export function generateStaticParams() {
  return loadGlossary().map((t) => ({ term: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { term } = await params;
  const t = getGlossaryTerm(term);
  return {
    title: t ? `${t.term} — Glossary — Q4N$P` : "Not found — Q4N$P",
    description: t?.definition,
    robots: "noindex",
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { term } = await params;
  const t = getGlossaryTerm(term);
  if (!t) notFound();

  const nodes = t.appearsIn
    .map(getNode)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  return (
    <PortalShell measure>
      <Breadcrumb
        items={[
          { label: "Glossary", href: "/glossary" },
          { label: t.term },
        ]}
      />
      <h1 className="font-head text-heading text-3xl mb-4">{t.term}</h1>
      <p className="text-[var(--text-primary)] text-lg leading-relaxed">
        {t.definition}
      </p>

      {nodes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Appears in
          </h2>
          <div className="flex flex-wrap gap-2">
            {nodes.map((n) => (
              <Link
                key={n.id}
                href={`/a/${n.pillarSlug}/${n.slug}`}
                className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-body)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                style={{ textDecoration: "none" }}
              >
                {n.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </PortalShell>
  );
}
