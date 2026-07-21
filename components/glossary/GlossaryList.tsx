"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GlossaryTerm } from "@/lib/content/glossary";

export default function GlossaryList({ terms }: { terms: GlossaryTerm[] }) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? terms.filter(
          (t) =>
            t.term.toLowerCase().includes(needle) ||
            t.definition.toLowerCase().includes(needle)
        )
      : terms;
    const byLetter = new Map<string, GlossaryTerm[]>();
    for (const t of filtered) {
      const letter = t.term[0]?.toUpperCase() ?? "#";
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!byLetter.has(key)) byLetter.set(key, []);
      byLetter.get(key)!.push(t);
    }
    return [...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [q, terms]);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter terms…"
        className="w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-body)] px-4 mb-6"
        style={{ fontSize: "16px" }}
      />

      {groups.length === 0 && (
        <p className="text-[var(--text-muted)]">No terms match “{q}”.</p>
      )}

      <div className="space-y-8">
        {groups.map(([letter, items]) => (
          <section key={letter}>
            <h2 className="font-head text-heading text-2xl mb-2">{letter}</h2>
            <dl className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
              {items.map((t) => (
                <div key={t.slug} className="py-3">
                  <dt>
                    <Link
                      href={`/glossary/${t.slug}`}
                      className="text-[var(--text-primary)] font-medium hover:text-[var(--accent)] transition-colors"
                      style={{ textDecoration: "none" }}
                    >
                      {t.term}
                    </Link>
                  </dt>
                  <dd className="text-sm text-[var(--text-muted)] mt-0.5 line-clamp-2">
                    {t.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
