"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GlossaryTerm } from "@/lib/content/glossary";
import type { Pillar } from "@/lib/content/tree";

type TreeNodeView = Pillar["nodes"][number] & { ready: boolean };
type PillarView = Omit<Pillar, "nodes"> & { nodes: TreeNodeView[]; readyCount: number };
type Props = { pillars: PillarView[]; terms: GlossaryTerm[]; initialTab?: "tree" | "glossary"; initialPillarSlug?: string };

const icons = ["▣", "◫", "⌁", "⌑", "♢", "⚙", "▤", "⌁", "⌂"];

export default function KnowledgeCenter({ pillars, terms, initialTab = "tree", initialPillarSlug }: Props) {
  const [tab, setTab] = useState<"tree" | "glossary">(initialTab);
  const [selected, setSelected] = useState(() => pillars.find((pillar) => pillar.slug === initialPillarSlug)?.slug ?? pillars[0]?.slug ?? "");
  const [query, setQuery] = useState("");
  const active = selected ? pillars.find((pillar) => pillar.slug === selected) : undefined;
  const filteredTerms = useMemo(() => terms.filter((term) => !query.trim() || `${term.term} ${term.definition}`.toLowerCase().includes(query.trim().toLowerCase())), [terms, query]);

  if (tab === "glossary") return <section className="v9-knowledge">
    <div className="v9-knowledge-tabs"><button onClick={() => setTab("tree")}>Knowledge Tree</button><button className="is-active">Glossary</button><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search glossary" /></div>
    <div className="v9-glossary-grid">{filteredTerms.map((term) => <Link key={term.slug} href={`/glossary/${term.slug}`}><h3>{term.term}</h3><p>{term.definition}</p></Link>)}{filteredTerms.length === 0 && <p className="v9-empty">No glossary terms match this search.</p>}</div>
  </section>;

  return <section className="v9-knowledge">
    <div className="v9-knowledge-tabs"><button className="is-active">Knowledge Tree</button><button onClick={() => setTab("glossary")}>Glossary</button></div>
    <div className="v9-pillar-grid">{pillars.map((pillar, index) => <button key={pillar.slug} type="button" className={`v9-pillar-card ${pillar.slug === selected ? "is-active" : ""}`} onClick={() => setSelected(pillar.slug)}>
      <span className={`v9-pillar-icon color-${(index % 5) + 1}`}>{icons[index] ?? "◫"}</span><span><strong>{pillar.title}</strong><small>{pillar.nodes.length} sub-topics · Admins & Advisors</small></span>
    </button>)}</div>
    {active && <div className="v9-pillar-detail">
      <div className="v9-pillar-detail-head"><h2>{active.title}</h2><button type="button" onClick={() => setSelected("")} aria-label="Close pillar">×</button></div>
      <div className="v9-topic-list">{active.nodes.map((node) => node.ready ? <Link key={node.id} href={`/a/${node.pillarSlug}/${node.slug}`}><span className="v9-topic-dot is-reviewed" /><span>{node.title}</span><em>Reviewed</em></Link> : <div key={node.id}><span className="v9-topic-dot is-draft" /><span>{node.title}</span><em>Coming soon</em></div>)}</div>
    </div>}
  </section>;
}
