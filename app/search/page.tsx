import type { Metadata } from "next";
import { Suspense } from "react";
import PortalShell from "@/components/portal/PortalShell";
import SearchResults from "@/components/search/SearchResults";

export const metadata: Metadata = {
  title: "Search — Q4N$P",
  description: "Search equity-compensation topics and glossary terms.",
  robots: "noindex",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <PortalShell>
      <h1 className="font-serif text-heading text-3xl mb-6">Search</h1>
      <Suspense fallback={<p className="text-[var(--text-muted)]">Loading…</p>}>
        <SearchResults initialQuery={q ?? ""} />
      </Suspense>
    </PortalShell>
  );
}
