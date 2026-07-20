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

  // Lazily load + build the index on first open.
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
      // focus after paint
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hits.length > 0) go(hits[0].path);
    else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 top-0 sm:top-[10vh] mx-auto w-full sm:max-w-xl px-0 sm:px-4">
        <div className="bg-surface-1 sm:rounded-xl border-b sm:border border-[var(--border)] overflow-hidden max-h-screen sm:max-h-[70vh] flex flex-col">
          <form onSubmit={onSubmit} className="flex items-center gap-2 px-4 border-b border-[var(--border)]">
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
              className="text-[var(--text-muted)] shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Search topics and terms…"
              className="w-full bg-transparent text-[var(--text-body)] py-4 focus:outline-none placeholder:text-[var(--text-muted)]"
              style={{ fontSize: "16px" }}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0"
              style={{ minWidth: "44px", minHeight: "44px" }}
            >
              ✕
            </button>
          </form>

          <div className="overflow-y-auto">
            {q.trim() && hits.length === 0 && (
              <p className="px-4 py-6 text-sm text-[var(--text-muted)]">
                No results for “{q}”.
              </p>
            )}
            <ul>
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => go(h.path)}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border)]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[var(--text-primary)] font-medium">
                        {h.title}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
                        {h.type}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--text-muted)] line-clamp-1">
                      {h.summary}
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
