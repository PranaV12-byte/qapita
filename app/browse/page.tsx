import type { Metadata } from "next";
import Link from "next/link";
import PortalShell from "@/components/portal/PortalShell";
import { PILLARS } from "@/lib/content/tree";
import { articleExists } from "@/lib/content/loader";

export const metadata: Metadata = {
  title: "Browse — Q4N$P",
  description: "Browse equity-compensation topics by pillar.",
};

export default function BrowsePage() {
  return (
    <PortalShell>
      <header className="mb-8">
        <h1 className="font-serif text-heading text-3xl mb-2">Browse topics</h1>
        <p className="text-[var(--text-body)]">
          Seven pillars covering the equity-compensation lifecycle, from award
          types through tax, accounting, and administration.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {PILLARS.map((p) => {
          const ready = p.nodes.filter((n) =>
            articleExists(n.pillarSlug, n.slug)
          ).length;
          return (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              className="q-card-link block p-5"
              style={{ textDecoration: "none" }}
            >
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h2 className="font-serif text-heading text-xl">{p.title}</h2>
                <span className="text-xs text-[var(--text-muted)] shrink-0">
                  {ready} article{ready === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {p.nodes.length} topic{p.nodes.length === 1 ? "" : "s"}
              </p>
            </Link>
          );
        })}
      </div>
    </PortalShell>
  );
}
