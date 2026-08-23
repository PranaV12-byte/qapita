import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import KnowledgeCenter from "@/components/knowledge/KnowledgeCenter";
import { loadGlossary } from "@/lib/content/glossary";

export const metadata: Metadata = {
  title: "Knowledge Tree | EquityIQ",
  description: "Browse equity compensation guidance by topic group.",
};

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const terms = loadGlossary();
  const { group } = await searchParams;
  return (
    <PortalShell>
      <header className="mb-8 space-y-3">
        <h1 className="font-head text-5xl text-[var(--text-head)]">
          Knowledge Tree
        </h1>
        <p className="max-w-4xl text-lg leading-8 text-[var(--text-body)]">
          Browse equity compensation topics and open the guidance that supports your work.
        </p>
      </header>
      <KnowledgeCenter terms={terms} initialGroupId={group} />
    </PortalShell>
  );
}
