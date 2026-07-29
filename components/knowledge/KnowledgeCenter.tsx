"use client";

import Link from "next/link";
import { useState } from "react";
import type { GlossaryTerm } from "@/lib/content/glossary";
import type { Pillar } from "@/lib/content/tree";

type TreeNodeView = Pillar["nodes"][number] & { ready: boolean };
type PillarView = Omit<Pillar, "nodes"> & {
  nodes: TreeNodeView[];
  readyCount: number;
};

type Tab = "tree" | "glossary";

type Props = {
  pillars: PillarView[];
  terms: GlossaryTerm[];
  initialTab?: Tab;
  initialPillarSlug?: string;
};

function countTone(readyCount: number, total: number): string {
  if (readyCount === total) return "bg-[#eefaf2] text-[#22a84f]";
  if (readyCount === 0) return "bg-[#fff3eb] text-[#e67a22]";
  return "bg-[#eefaf2] text-[#22a84f]";
}

function rowTone(ready: boolean): string {
  return ready ? "bg-[#eefaf2] text-[#22a84f]" : "bg-[#fff3eb] text-[#e67a22]";
}

export default function KnowledgeCenter({
  pillars,
  terms,
  initialTab = "tree",
  initialPillarSlug,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    pillars.forEach((pillar, index) => {
      state[pillar.slug] = initialPillarSlug
        ? pillar.slug === initialPillarSlug
        : index === 0;
    });
    return state;
  });
  const [query, setQuery] = useState("");

  const filteredTerms = terms.filter((term) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      term.term.toLowerCase().includes(needle) ||
      term.definition.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-[var(--border)] bg-white p-1">
          {[
            { id: "tree" as const, label: "Knowledge tree" },
            { id: "glossary" as const, label: "Glossary" },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className="min-h-[44px] rounded-xl px-4 text-sm font-semibold transition"
                style={{
                  backgroundColor: active ? "var(--accent-solid)" : "transparent",
                  color: active ? "white" : "var(--text-body)",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {tab === "tree" ? (
          <p className="text-sm text-[var(--text-muted)]">
            Reviewed and in-progress topics across the seven pillars.
          </p>
        ) : (
          <div className="w-full max-w-sm">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter glossary terms"
              className="w-full min-h-[48px] rounded-xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--text-body)]"
            />
          </div>
        )}
      </div>

      {tab === "tree" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {pillars.map((pillar) => {
            const open = expanded[pillar.slug];
            return (
              <section
                key={pillar.slug}
                className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-white ${
                  open ? "xl:col-span-2" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) => ({
                      ...current,
                      [pillar.slug]: !current[pillar.slug],
                    }))
                  }
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    {String(pillar.id).padStart(2, "0")}
                  </span>
                  <span className="font-head text-[1.65rem] leading-tight text-[var(--text-head)]">
                    {pillar.title}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${countTone(
                      pillar.readyCount,
                      pillar.nodes.length
                    )}`}
                  >
                    {pillar.readyCount} of {pillar.nodes.length}
                  </span>
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
                    className="text-[var(--text-muted)]"
                    style={{
                      transform: open ? "rotate(180deg)" : "none",
                      transition: "transform 160ms ease",
                    }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {open && (
                  <div className="grid border-t border-[var(--border)] md:grid-cols-2">
                    {pillar.nodes.map((node) => (
                      <Link
                        key={node.id}
                        href={
                          node.ready
                            ? `/a/${node.pillarSlug}/${node.slug}`
                            : `/p/${pillar.slug}`
                        }
                        className="flex items-center gap-4 border-b border-r border-[var(--border)] px-5 py-4 last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0"
                        style={{ textDecoration: "none" }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-medium leading-7 text-[var(--text-primary)]">
                            {node.title}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${rowTone(
                            node.ready
                          )}`}
                        >
                          {node.ready ? "Reviewed" : "In progress"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredTerms.map((term) => (
            <Link
              key={term.slug}
              href={`/glossary/${term.slug}`}
              className="q-card-link block p-5"
              style={{ textDecoration: "none" }}
            >
              <h3 className="font-head text-2xl text-[var(--text-head)]">
                {term.term}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">
                {term.definition}
              </p>
            </Link>
          ))}
          {filteredTerms.length === 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--text-muted)]">
              No glossary terms match this search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
