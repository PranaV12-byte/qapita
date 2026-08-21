"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type WikiArticle = {
  id: string;
  title: string;
  slug: string;
  pillarSlug: string;
  pillarTitle: string;
  summary: string;
};

export default function WikiIndex({ articles }: { articles: WikiArticle[] }) {
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState("all");
  const pillars = useMemo(() => Array.from(new Map(articles.map((article) => [article.pillarSlug, article.pillarTitle])).entries()), [articles]);
  const filtered = articles.filter((article) => {
    const needle = query.trim().toLowerCase();
    const matchesPillar = pillar === "all" || article.pillarSlug === pillar;
    const matchesQuery = !needle || `${article.title} ${article.summary} ${article.pillarTitle}`.toLowerCase().includes(needle);
    return matchesPillar && matchesQuery;
  });

  return <div className="v9-wiki-index">
    <div className="v9-wiki-filters">
      <label><span aria-hidden="true">⌕</span><span className="sr-only">Search Wiki articles</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Wiki" /></label>
      <select value={pillar} onChange={(event) => setPillar(event.target.value)} aria-label="Filter by pillar"><option value="all">All knowledge groups</option>{pillars.map(([slug, title]) => <option key={slug} value={slug}>{title}</option>)}</select>
    </div>
    <p className="v9-wiki-count">{filtered.length} published {filtered.length === 1 ? "article" : "articles"} in the Wiki</p>
    <div className="v9-wiki-grid">
      {filtered.map((article) => <Link key={article.id} href={`/a/${article.pillarSlug}/${article.slug}`}><p>{article.pillarTitle}</p><h2>{article.title}</h2><span>{article.summary}</span><strong>Read article →</strong></Link>)}
      {filtered.length === 0 && <div className="v9-empty">No published Wiki articles match that search.</div>}
    </div>
  </div>;
}
