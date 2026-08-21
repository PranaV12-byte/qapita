"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GlossaryTerm } from "@/lib/content/glossary";
import type { Pillar } from "@/lib/content/tree";

type TreeNodeView = Pillar["nodes"][number] & { ready: boolean };
type PillarView = Omit<Pillar, "nodes"> & { nodes: TreeNodeView[]; readyCount: number };
type Props = { pillars: PillarView[]; terms: GlossaryTerm[]; initialTab?: "tree" | "glossary"; initialPillarSlug?: string };

const icons = ["▣", "◫", "⌁", "⌑", "♢", "⚙", "▤", "⌁", "⌂"];

function PillarCard({ pillar, index, selected, onSelect }: { pillar: PillarView; index: number; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`v9-pillar-card ${selected ? "is-active" : ""}`} onClick={onSelect} aria-expanded={selected}>
    <span className={`v9-pillar-icon color-${(index % 5) + 1}`} aria-hidden="true">{icons[index] ?? "◫"}</span>
    <span><strong>{pillar.title}</strong><small>{pillar.nodes.length} topics</small></span>
  </button>;
}

function Detail({ pillar, onClose }: { pillar: PillarView; onClose: () => void }) {
  return <div className="v9-pillar-detail">
    <div className="v9-pillar-detail-head"><h2>{pillar.title}</h2><button type="button" onClick={onClose} aria-label={`Close ${pillar.title}`}>×</button></div>
    <div className="v9-topic-list">
      {pillar.nodes.map((node) => node.ready ? (
        <Link key={node.id} href={`/a/${node.pillarSlug}/${node.slug}`}><span>{node.title}</span><span aria-hidden="true">→</span></Link>
      ) : (
        <div key={node.id} aria-disabled="true"><span>{node.title}</span></div>
      ))}
    </div>
  </div>;
}

export default function KnowledgeCenter({ pillars, terms, initialTab = "tree", initialPillarSlug }: Props) {
  const [tab, setTab] = useState<"tree" | "glossary">(initialTab);
  const [selected, setSelected] = useState<string | null>(() => pillars.find((pillar) => pillar.slug === initialPillarSlug)?.slug ?? pillars[0]?.slug ?? null);
  const [query, setQuery] = useState("");
  const active = selected ? pillars.find((pillar) => pillar.slug === selected) : undefined;
  const filteredTerms = useMemo(() => terms.filter((term) => !query.trim() || `${term.term} ${term.definition}`.toLowerCase().includes(query.trim().toLowerCase())), [terms, query]);
  const select = (slug: string) => setSelected((current) => current === slug ? null : slug);

  if (tab === "glossary") return <section className="v9-knowledge">
    <div className="v9-knowledge-tabs"><button type="button" onClick={() => setTab("tree")}>Knowledge Tree</button><button type="button" className="is-active">Glossary</button><label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search glossary" aria-label="Search glossary" /></label></div>
    <div className="v9-glossary-grid">{filteredTerms.map((term) => <Link key={term.slug} href={`/glossary/${term.slug}`}><h3>{term.term}</h3><p>{term.definition}</p></Link>)}{filteredTerms.length === 0 && <p className="v9-empty">No glossary terms match this search.</p>}</div>
  </section>;

  const renderRows = (rowSize: number) => {
    const rows: PillarView[][] = [];
    for (let index = 0; index < pillars.length; index += rowSize) rows.push(pillars.slice(index, index + rowSize));
    return rows.map((row, rowIndex) => <div className="v9-pillar-row" key={`${rowSize}-${rowIndex}`}>
      <div className="v9-pillar-grid">{row.map((pillar) => <PillarCard key={pillar.slug} pillar={pillar} index={pillars.indexOf(pillar)} selected={pillar.slug === selected} onSelect={() => select(pillar.slug)} />)}</div>
      {active && row.some((pillar) => pillar.slug === active.slug) ? <Detail pillar={active} onClose={() => setSelected(null)} /> : null}
    </div>);
  };

  return <section className="v9-knowledge">
    <div className="v9-knowledge-tabs"><button type="button" className="is-active">Knowledge Tree</button><button type="button" onClick={() => setTab("glossary")}>Glossary</button></div>
    <div className="v9-knowledge-rows v9-knowledge-desktop">{renderRows(3)}</div>
    <div className="v9-knowledge-rows v9-knowledge-tablet">{renderRows(2)}</div>
    <div className="v9-knowledge-rows v9-knowledge-mobile">{renderRows(1)}</div>
  </section>;
}
