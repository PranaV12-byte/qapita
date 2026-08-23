import type { Metadata } from "next";
import KnowledgeCenter from "@/components/knowledge/KnowledgeCenter";
import PortalShell from "@/components/portal/PortalShell";
import { loadGlossary } from "@/lib/content/glossary";

export const metadata: Metadata = {
  title: "Glossary | EquityIQ",
  description: "Plain-language definitions of equity compensation terms.",
};

export default function GlossaryPage() {
  const terms = loadGlossary();
  return (
    <PortalShell>
      <header className="mb-8">
        <h1 className="font-head text-5xl text-[var(--text-head)]">
          Glossary
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--text-body)]">
          Plain-language equity compensation terms for practical reference.
        </p>
      </header>
      <KnowledgeCenter terms={terms} initialTab="glossary" />
    </PortalShell>
  );
}
