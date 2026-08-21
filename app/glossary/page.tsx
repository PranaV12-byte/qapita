import type { Metadata } from "next";
import KnowledgeCenter from "@/components/knowledge/KnowledgeCenter";
import PortalShell from "@/components/portal/PortalShell";
import { loadGlossary } from "@/lib/content/glossary";
import { articleExists } from "@/lib/content/loader";
import { DISPLAY_PILLARS } from "@/lib/content/tree";

export const metadata: Metadata = {
  title: "Glossary - Q4N$P",
  description: "Plain-language definitions of equity compensation terms.",
};

export default function GlossaryPage() {
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
      <header className="mb-8">
        <h1 className="font-head text-5xl text-[var(--text-head)]">
          Glossary
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--text-body)]">
          {terms.length} plain-language equity compensation terms, written for practical reference and linked back to the library.
        </p>
      </header>
      <KnowledgeCenter pillars={pillars} terms={terms} initialTab="glossary" />
    </PortalShell>
  );
}
