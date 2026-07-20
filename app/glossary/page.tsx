import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import GlossaryList from "@/components/glossary/GlossaryList";
import { loadGlossary } from "@/lib/content/glossary";

export const metadata: Metadata = {
  title: "Glossary — Q4N$P",
  description: "Plain-language definitions of equity-compensation terms.",
};

export default function GlossaryPage() {
  const terms = loadGlossary();
  return (
    <PortalShell>
      <header className="mb-6">
        <h1 className="font-serif text-heading text-3xl mb-2">Glossary</h1>
        <p className="text-[var(--text-body)]">
          {terms.length} equity-compensation terms, defined in plain language.
        </p>
      </header>
      <GlossaryList terms={terms} />
    </PortalShell>
  );
}
