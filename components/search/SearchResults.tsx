"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type MiniSearch from "minisearch";
import {
  buildIndex,
  loadSearchDocs,
  runSearch,
  type SearchHit,
} from "@/lib/search/client";
import type { SearchDoc } from "@/lib/search/types";

export default function SearchResults({
  initialQuery,
}: {
  initialQuery: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [ready, setReady] = useState(false);
  const indexRef = useRef<MiniSearch<SearchDoc> | null>(null);

  useEffect(() => {
    loadSearchDocs().then((docs) => {
      indexRef.current = buildIndex(docs);
      setReady(true);
      if (initialQuery) setHits(runSearch(indexRef.current, initialQuery, 50));
    });
  }, [initialQuery]);

  const onChange = (value: string) => {
    setQ(value);
    setHits(indexRef.current ? runSearch(indexRef.current, value, 50) : []);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    router.replace(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit}>
        <input
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search the library, glossary, and related guidance"
          className="w-full min-h-[52px] rounded-2xl border border-[var(--border)] bg-white px-5 text-base text-[var(--text-body)]"
          autoFocus
        />
      </form>

      {!ready && <p className="text-[var(--text-muted)]">Loading index...</p>}

      {ready && q.trim() && (
        <p className="text-sm text-[var(--text-muted)]">
          {hits.length} result{hits.length === 1 ? "" : "s"} for &quot;{q.trim()}&quot;
        </p>
      )}

      <div className="space-y-3">
        {hits.map((hit) => (
          <Link
            key={hit.id}
            href={hit.path}
            className="q-card-link block p-5"
            style={{ textDecoration: "none" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-head text-2xl text-[var(--text-head)]">
                {hit.title}
              </span>
              <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {hit.type}
              </span>
              {hit.pillar && (
                <span className="text-sm text-[var(--text-muted)]">
                  {hit.pillar}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-7 text-[var(--text-body)]">
              {hit.summary}
            </p>
          </Link>
        ))}
      </div>

      {ready && q.trim() && hits.length === 0 && (
        <p className="text-[var(--text-muted)]">
          No results matched this search. Browse the
          {" "}
          <Link href="/browse" className="text-[var(--accent)] hover:underline">
            library
          </Link>
          {" "}
          for a broader starting point.
        </p>
      )}
    </div>
  );
}
