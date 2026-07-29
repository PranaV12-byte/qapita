import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import KnowledgeCenter from "@/components/knowledge/KnowledgeCenter";
import { loadGlossary } from "@/lib/content/glossary";
import { articleExists } from "@/lib/content/loader";
import { PILLARS } from "@/lib/content/tree";

export const metadata: Metadata = {
  title: "Knowledge tree - Q4N$P",
  description: "Browse equity compensation topics by pillar.",
};

export default function BrowsePage() {
  const terms = loadGlossary();
  const pillars = PILLARS.map((pillar) => ({
    ...pillar,
    nodes: pillar.nodes.map((node) => ({
      ...node,
      ready: articleExists(node.pillarSlug, node.slug),
    })),
    readyCount: pillar.nodes.filter((node) =>
      articleExists(node.pillarSlug, node.slug)
    ).length,
  }));

  return (
    <PortalShell>
      <header className="mb-8 space-y-3">
        <h1 className="font-head text-5xl text-[var(--text-head)]">
          Knowledge tree
        </h1>
        <p className="max-w-4xl text-lg leading-8 text-[var(--text-body)]">
          Seven professional-grade pillars, US-scoped. Reading is open and drafting remains grounded in the reviewed library.
        </p>
        <div className="flex flex-wrap gap-5 text-sm text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22b45a]" />
            Reviewed
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f28c38]" />
            In progress
          </span>
        </div>
      </header>
      <KnowledgeCenter pillars={pillars} terms={terms} />
    </PortalShell>
  );
}
