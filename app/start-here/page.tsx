import type { Metadata } from "next";
import Link from "next/link";
import PortalShell from "@/components/portal/PortalShell";
import { LensProvider } from "@/components/lens/LensProvider";
import { START_HERE_CARDS } from "@/lib/content/start-here";
import { getNode } from "@/lib/content/tree";

export const metadata: Metadata = {
  title: "Start here — Q4N$P",
  description: "New to equity compensation? Begin with the basics.",
};

export default function StartHerePage() {
  return (
    <LensProvider force="plain">
      <PortalShell>
        <header className="mb-6">
          <h1 className="font-serif text-heading text-3xl mb-2">Start here</h1>
          <p className="text-[var(--text-body)]">
            New to equity compensation? These six basics explain how it works —
            in plain language.
          </p>
          <p className="mt-2 text-xs text-[var(--accent)]">
            Shown in plain language.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {START_HERE_CARDS.map((card, i) => {
            const node = getNode(card.nodeId);
            const href = node
              ? `/a/${node.pillarSlug}/${node.slug}`
              : "/browse";
            return (
              <Link
                key={card.slug}
                href={href}
                className="block rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5 hover:border-[var(--accent)] transition-colors"
                style={{ textDecoration: "none" }}
              >
                <div className="text-xs text-[var(--text-muted)] mb-2">
                  {i + 1} of {START_HERE_CARDS.length}
                </div>
                <h2 className="font-serif text-heading text-xl mb-1">
                  {card.title}
                </h2>
                <p className="text-sm text-[var(--text-body)] leading-relaxed">
                  {card.blurb}
                </p>
              </Link>
            );
          })}
        </div>
      </PortalShell>
    </LensProvider>
  );
}
