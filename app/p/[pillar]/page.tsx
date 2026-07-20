import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import Breadcrumb from "@/components/article/Breadcrumb";
import { PILLARS, getPillar } from "@/lib/content/tree";
import { articleExists } from "@/lib/content/loader";

type Params = { pillar: string };

export function generateStaticParams() {
  return PILLARS.map((p) => ({ pillar: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pillar } = await params;
  const p = getPillar(pillar);
  return { title: p ? `${p.title} — Q4N$P` : "Not found — Q4N$P" };
}

export default async function PillarPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { pillar } = await params;
  const p = getPillar(pillar);
  if (!p) notFound();

  return (
    <PortalShell>
      <Breadcrumb
        items={[
          { label: "Browse", href: "/browse" },
          { label: p.title },
        ]}
      />
      <h1 className="font-serif text-heading text-3xl mb-6">{p.title}</h1>

      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {p.nodes.map((n) => {
          const ready = articleExists(n.pillarSlug, n.slug);
          return (
            <li key={n.id}>
              {ready ? (
                <Link
                  href={`/a/${n.pillarSlug}/${n.slug}`}
                  className="flex items-center gap-3 py-4 group"
                  style={{ textDecoration: "none" }}
                >
                  <span className="text-xs text-[var(--text-muted)] w-8 shrink-0">
                    {n.id}
                  </span>
                  <span className="text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    {n.title}
                  </span>
                  <span className="ml-auto text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                    →
                  </span>
                </Link>
              ) : (
                <div className="flex items-center gap-3 py-4">
                  <span className="text-xs text-[var(--text-muted)] w-8 shrink-0">
                    {n.id}
                  </span>
                  <span className="text-[var(--text-muted)]">{n.title}</span>
                  <span className="ml-auto text-xs text-[var(--text-muted)]">
                    Coming soon
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </PortalShell>
  );
}
