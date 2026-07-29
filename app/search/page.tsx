import type { Metadata } from "next";
import { Suspense } from "react";
import PortalShell from "@/components/portal/PortalShell";
import SearchResults from "@/components/search/SearchResults";

export const metadata: Metadata = {
  title: "Search - Q4N$P",
  description: "Search equity compensation topics and glossary terms.",
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
      <header className="mb-8">
        <h1 className="font-head text-5xl text-[var(--text-head)]">Search</h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--text-body)]">
          Search topics, articles, drafting references, and glossary terms across the full workspace.
        </p>
      </header>
      <Suspense fallback={<p className="text-[var(--text-muted)]">Loading...</p>}>
        <SearchResults initialQuery={q ?? ""} />
      </Suspense>
    </PortalShell>
  );
}
