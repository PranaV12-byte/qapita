"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GlossaryTerm } from "@/lib/content/glossary";
import { V9_TAXONOMY, type V9Group, type V9Subtopic } from "@/lib/content/v9-taxonomy";

type Props = { terms: GlossaryTerm[]; initialTab?: "tree" | "glossary"; initialGroupId?: string };
const icons = ["▣", "◫", "⌁", "⌑", "♢", "⚙", "▤", "⌂", "⌕"];

function GroupCard({ group, index, selected, onSelect }: { group: V9Group; index: number; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`v9-pillar-card ${selected ? "is-active" : ""} ${group.comingSoon ? "is-disabled" : ""}`} onClick={onSelect} aria-expanded={selected}>
    <span className={`v9-pillar-icon color-${(index % 5) + 1}`} aria-hidden="true">{icons[index] ?? "◫"}</span>
    <span><strong>{group.name}</strong><small>{group.subtopics.length} sub-topics{group.comingSoon ? " · Coming soon" : ""}</small></span>
  </button>;
}

function Subtopic({ topic, disabled }: { topic: V9Subtopic; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const inactive = disabled || topic.comingSoon;
  return <div className={`v9-subtopic ${open ? "is-open" : ""}`}>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} disabled={inactive}><span>{topic.name}</span><span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <div className="v9-leaf-list">{topic.leaves.map((leaf) => inactive ? <span className="v9-leaf-row is-disabled" key={leaf.name}>{leaf.name}</span> : <Link className="v9-leaf-row" key={leaf.name} href={`/wiki?q=${encodeURIComponent(leaf.name)}&topic=${encodeURIComponent(topic.id)}`}>{leaf.name}<span aria-hidden="true">→</span></Link>)}</div>}
  </div>;
}

function Detail({ group, onClose }: { group: V9Group; onClose: () => void }) {
  return <div className="v9-pillar-detail"><div className="v9-pillar-detail-head"><h2>{group.name}</h2><button type="button" onClick={onClose} aria-label={`Close ${group.name}`}>×</button></div>{group.comingSoon ? <p className="v9-empty">This section is coming soon.</p> : <div className="v9-topic-list">{group.subtopics.map((topic) => <Subtopic key={topic.id} topic={topic} disabled={group.comingSoon} />)}</div>}</div>;
}

export default function KnowledgeCenter({ terms, initialTab = "tree", initialGroupId }: Props) {
  const [tab, setTab] = useState<"tree" | "glossary">(initialTab);
  const [selected, setSelected] = useState<string | null>(() => V9_TAXONOMY.some((group) => group.id === initialGroupId) ? initialGroupId ?? null : null);
  const [query, setQuery] = useState("");
  const active = selected ? V9_TAXONOMY.find((group) => group.id === selected) : undefined;
  const filteredTerms = useMemo(() => terms.filter((term) => !query.trim() || `${term.term} ${term.definition}`.toLowerCase().includes(query.trim().toLowerCase())), [terms, query]);
  const select = (groupId: string) => setSelected((current) => current === groupId ? null : groupId);
  const renderRows = (rowSize: number) => {
    const rows: V9Group[][] = [];
    for (let index = 0; index < V9_TAXONOMY.length; index += rowSize) rows.push(V9_TAXONOMY.slice(index, index + rowSize));
    return rows.map((row, rowIndex) => <div className="v9-pillar-row" key={`${rowSize}-${rowIndex}`}><div className="v9-pillar-grid">{row.map((group) => <GroupCard key={group.id} group={group} index={V9_TAXONOMY.indexOf(group)} selected={group.id === selected} onSelect={() => select(group.id)} />)}</div>{active && row.some((group) => group.id === active.id) ? <Detail group={active} onClose={() => setSelected(null)} /> : null}</div>);
  };

  if (tab === "glossary") return <section className="v9-knowledge"><div className="v9-knowledge-tabs"><button type="button" onClick={() => setTab("tree")}>Knowledge Tree</button><button type="button" className="is-active">Glossary</button><label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search glossary" aria-label="Search glossary" /></label></div><div className="v9-glossary-grid">{filteredTerms.map((term) => <Link key={term.slug} href={`/glossary/${term.slug}`}><h3>{term.term}</h3><p>{term.definition}</p></Link>)}{filteredTerms.length === 0 && <p className="v9-empty">No glossary terms match this search.</p>}</div></section>;
  return <section className="v9-knowledge"><div className="v9-knowledge-tabs"><button type="button" className="is-active">Knowledge Tree</button><button type="button" onClick={() => setTab("glossary")}>Glossary</button></div><div className="v9-knowledge-rows v9-knowledge-desktop">{renderRows(3)}</div><div className="v9-knowledge-rows v9-knowledge-tablet">{renderRows(2)}</div><div className="v9-knowledge-rows v9-knowledge-mobile">{renderRows(1)}</div></section>;
}
