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

export default function SearchResults({ initialQuery }: { initialQuery: string }) {
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Keep the URL shareable / in sync with the query.
    router.replace(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
  };

  return (
    <div>
      <form onSubmit={onSubmit} className="mb-6">
        <input
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search topics and terms…"
          className="w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-body)] px-4"
          style={{ fontSize: "16px" }}
          autoFocus
        />
      </form>

      {!ready && <p className="text-[var(--text-muted)]">Loading index…</p>}

      {ready && q.trim() && (
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {hits.length} result{hits.length === 1 ? "" : "s"} for “{q.trim()}”
        </p>
      )}

      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {hits.map((h) => (
          <li key={h.id}>
            <Link
              href={h.path}
              className="block py-4 group"
              style={{ textDecoration: "none" }}
            >
              <span className="flex items-center gap-2 mb-0.5">
                <span className="text-[var(--text-primary)] font-medium group-hover:text-[var(--accent)] transition-colors">
                  {h.title}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
                  {h.type}
                </span>
                {h.pillar && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {h.pillar}
                  </span>
                )}
              </span>
              <span className="text-sm text-[var(--text-muted)] line-clamp-2">
                {h.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {ready && q.trim() && hits.length === 0 && (
        <p className="text-[var(--text-muted)]">
          No results. Try a different term, or{" "}
          <Link href="/browse" className="text-[var(--accent)] hover:underline">
            browse all topics
          </Link>
          .
        </p>
      )}
    </div>
  );
}
