"use client";

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

export default function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const indexRef = useRef<MiniSearch<SearchDoc> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || indexRef.current) return;
    loadSearchDocs().then((docs) => {
      indexRef.current = buildIndex(docs);
      if (q) setHits(runSearch(indexRef.current, q));
    });
  }, [open, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onChange = (value: string) => {
    setQ(value);
    setHits(indexRef.current ? runSearch(indexRef.current, value) : []);
  };

  const go = (path: string) => {
    onClose();
    router.push(path);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (hits.length > 0) go(hits[0].path);
    else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="absolute inset-0 bg-[rgba(18,11,36,0.48)] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 top-[72px] mx-auto w-full max-w-4xl px-4 pt-5">
        <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_30px_80px_rgba(54,36,99,0.18)]">
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-[var(--text-muted)]"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Search the library, glossary, and related guidance"
              className="w-full bg-transparent py-2 text-base text-[var(--text-body)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text-muted)]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m18 6-12 12" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </form>

          <div className="max-h-[70vh] overflow-y-auto">
            {q.trim() && hits.length === 0 && (
              <p className="px-5 py-6 text-sm text-[var(--text-muted)]">
                No results found for &quot;{q}&quot;.
              </p>
            )}
            <ul className="divide-y divide-[var(--border)]">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    onClick={() => go(hit.path)}
                    className="flex w-full flex-col items-start gap-1 px-5 py-4 text-left transition hover:bg-[var(--surface-2)]"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {hit.title}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {hit.type}
                      </span>
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">
                      {hit.summary}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
