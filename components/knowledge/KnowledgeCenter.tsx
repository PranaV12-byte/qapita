"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import type { GlossaryTerm } from "@/lib/content/glossary";
import type {
  KnowledgeArticle,
  KnowledgeGroup,
  KnowledgeLeaf,
  KnowledgeSubtopic,
} from "@/lib/content/knowledge-tree";

type Props = {
  terms: GlossaryTerm[];
  knowledgeTree: KnowledgeGroup[];
  initialTab?: "tree" | "glossary";
  initialGroupId?: string;
};

const iconPaths: Record<string, string> = {
  "ti-certificate": "M12 3 14.2 5.1 17.2 4.8 18.2 7.7 20.7 9.4 19.5 12 20.7 14.6 18.2 16.3 17.2 19.2 14.2 18.9 12 21 9.8 18.9 6.8 19.2 5.8 16.3 3.3 14.6 4.5 12 3.3 9.4 5.8 7.7 6.8 4.8 9.8 5.1 12 3Z",
  "ti-calendar-event": "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 5h14M8 2v4m8-4v4m-7 7h2m2 0h2m-6 3h2",
  "ti-receipt-tax": "M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Zm3 5h6m-6 4h6m-6 4h3",
  "ti-gavel": "m14 5 5 5m-7-7 7 7m-9-5L5 14m4-7 7 7m-2-9 3 3-9 9-3-3 9-9ZM3 21h9",
  "ti-settings": "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  "ti-report-analytics": "M4 19V5m0 14h16M8 16v-5m4 5V7m4 9v-8",
  "ti-chart-line": "M4 18 9 13l3 3 7-8m-4 0h4v4",
  "ti-building-bank": "m3 10 9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M2 10h20",
  "ti-tool": "m14.7 6.3 3-3a5 5 0 0 0-6.2 6.2L4 17a2.1 2.1 0 1 0 3 3l7.5-7.5a5 5 0 0 0 6.2-6.2l-3 3-3-3Z",
};

function KnowledgeGroupIcon({ icon }: { icon: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" data-icon={icon}>
      <path d={iconPaths[icon] ?? iconPaths["ti-tool"]} />
    </svg>
  );
}

function GroupCard({
  group,
  index,
  selected,
  onSelect,
}: {
  group: KnowledgeGroup;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const preparationCount = group.subtopics.filter((topic) => topic.status === "preparation").length;
  return (
    <button
      type="button"
      className={`v9-pillar-card ${selected ? "is-active" : ""}`}
      onClick={onSelect}
      aria-expanded={selected}
    >
      <span className={`v9-pillar-icon color-${(index % 5) + 1}`} aria-hidden="true">
        <KnowledgeGroupIcon icon={group.icon} />
      </span>
      <span>
        <strong>{group.name}</strong>
        <small>
          {group.subtopics.length} sub-topics
          {preparationCount > 0 ? ` · ${preparationCount} in preparation` : ""}
        </small>
      </span>
    </button>
  );
}

function ArticleLinks({ articles }: { articles: KnowledgeArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <div className="v9-subtopic-guidance">
      <p>Published guidance</p>
      {articles.map((article) => (
        <Link className="v9-leaf-row" key={article.id} href={article.href}>
          {article.title}
          <span aria-hidden="true">→</span>
        </Link>
      ))}
    </div>
  );
}

function LeafRow({ leaf }: { leaf: KnowledgeLeaf }) {
  if (!leaf.href) {
    return (
      <span className="v9-leaf-row is-disabled" title="Content in preparation">
        <span>{leaf.name}</span>
        <small>Content in preparation</small>
      </span>
    );
  }
  return (
    <Link className="v9-leaf-row" href={leaf.href}>
      <span>{leaf.name}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function Subtopic({ topic }: { topic: KnowledgeSubtopic }) {
  const [open, setOpen] = useState(false);
  const isPreparation = topic.status === "preparation" || topic.comingSoon;
  return (
    <div className={`v9-subtopic ${open ? "is-open" : ""}`}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{topic.name}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="v9-subtopic-content">
          <ArticleLinks articles={topic.articles} />
          {topic.leaves.length > 0 && (
            <div className="v9-leaf-list">
              {topic.leaves.map((leaf) => <LeafRow key={leaf.name} leaf={leaf} />)}
            </div>
          )}
          {isPreparation && topic.articles.length === 0 && (
            <p className="v9-preparation-message">Content in preparation. Guidance for this topic is coming soon.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ group, onClose }: { group: KnowledgeGroup; onClose: () => void }) {
  return (
    <div className="v9-pillar-detail">
      <div className="v9-pillar-detail-head">
        <div>
          <h2>{group.name}</h2>
          {group.comingSoon && <p className="v9-preparation-message">This section is coming soon.</p>}
        </div>
        <button type="button" className="v9-pillar-detail-close" onClick={onClose} aria-label={`Close ${group.name}`}>×</button>
      </div>
      <div className="v9-topic-list">
        {group.subtopics.map((topic) => <Subtopic key={topic.id} topic={topic} />)}
      </div>
    </div>
  );
}

export default function KnowledgeCenter({ terms, knowledgeTree, initialTab = "tree", initialGroupId }: Props) {
  const [tab, setTab] = useState<"tree" | "glossary">(initialTab);
  const [selected, setSelected] = useState<string | null>(() =>
    knowledgeTree.some((group) => group.id === initialGroupId) ? initialGroupId ?? null : null
  );
  const [query, setQuery] = useState("");
  const active = selected ? knowledgeTree.find((group) => group.id === selected) : undefined;
  const selectedIndex = active ? knowledgeTree.findIndex((group) => group.id === active.id) : -1;
  const detailStyle = selectedIndex >= 0 ? {
    "--detail-row-desktop": Math.floor(selectedIndex / 3) + 2,
    "--detail-row-tablet": Math.floor(selectedIndex / 2) + 2,
    "--detail-row-mobile": selectedIndex + 2,
  } as CSSProperties : undefined;
  const filteredTerms = useMemo(
    () => terms.filter((term) => !query.trim() || `${term.term} ${term.definition}`.toLowerCase().includes(query.trim().toLowerCase())),
    [terms, query]
  );
  const select = (groupId: string) => setSelected((current) => current === groupId ? null : groupId);

  if (tab === "glossary") {
    return (
      <section className="v9-knowledge">
        <div className="v9-knowledge-tabs">
          <button type="button" onClick={() => setTab("tree")}>Knowledge Tree</button>
          <button type="button" className="is-active">Glossary</button>
        </div>
        <div className="v9-glossary-search" role="search">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search terms and definitions" aria-label="Search glossary" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear glossary search">Clear</button>}
        </div>
        <div className="v9-glossary-grid">
          {filteredTerms.map((term) => <Link key={term.slug} href={`/glossary/${term.slug}`}><h3>{term.term}</h3><p>{term.definition}</p></Link>)}
          {filteredTerms.length === 0 && <p className="v9-empty">No glossary terms match this search.</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="v9-knowledge">
      <div className="v9-knowledge-tabs">
        <button type="button" className="is-active">Knowledge Tree</button>
        <button type="button" onClick={() => setTab("glossary")}>Glossary</button>
      </div>
      <div className="v9-knowledge-tree">
        <div className="v9-pillar-grid">
          {knowledgeTree.map((group, index) => (
            <GroupCard key={group.id} group={group} index={index} selected={group.id === selected} onSelect={() => select(group.id)} />
          ))}
          {active && <div className="v9-pillar-detail-slot" style={detailStyle}><Detail key={active.id} group={active} onClose={() => setSelected(null)} /></div>}
        </div>
      </div>
    </section>
  );
}
