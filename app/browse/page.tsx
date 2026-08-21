import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import KnowledgeCenter from "@/components/knowledge/KnowledgeCenter";
import { loadGlossary } from "@/lib/content/glossary";
import { articleExists } from "@/lib/content/loader";
import { DISPLAY_PILLARS } from "@/lib/content/tree";

export const metadata: Metadata = {
  title: "Knowledge Tree - Q4N$P",
  description: "Browse equity compensation guidance by topic group.",
};

export default function BrowsePage() {
  const terms = loadGlossary();
  const pillars = DISPLAY_PILLARS.map((pillar) => ({
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
          Knowledge Tree
        </h1>
        <p className="max-w-4xl text-lg leading-8 text-[var(--text-body)]">
          Explore the complete map of EquityIQ topics. Published topics open directly into the Wiki; planned topics show where the knowledge base is growing next.
        </p>
      </header>
      <KnowledgeCenter pillars={pillars} terms={terms} />
    </PortalShell>
  );
}
