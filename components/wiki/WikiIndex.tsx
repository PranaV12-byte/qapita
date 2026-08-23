"use client";

import Link from "next/link";
import { useState } from "react";

type WikiArticle = {
  id: string;
  title: string;
  slug: string;
  pillarSlug: string;
  pillarTitle: string;
  summary: string;
  searchText: string;
};

export default function WikiIndex({ articles, initialQuery = "" }: { articles: WikiArticle[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const filtered = articles.filter((article) => {
    const needle = query.trim().toLowerCase();
    return !needle || `${article.title} ${article.summary} ${article.pillarTitle} ${article.searchText}`.toLowerCase().includes(needle);
  });

  return <div className="v9-wiki-index">
    <div className="v9-wiki-filters">
      <label><span aria-hidden="true">⌕</span><span className="sr-only">Search Wiki articles</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Wiki" /></label>
    </div>
    <div className="v9-wiki-grid">
      {filtered.map((article) => <Link key={article.id} href={`/a/${article.pillarSlug}/${article.slug}`}><p>{article.pillarTitle}</p><h2>{article.title}</h2><span>{article.summary}</span><strong>Read article →</strong></Link>)}
      {filtered.length === 0 && <div className="v9-empty">No published Wiki articles match that search.</div>}
    </div>
  </div>;
}
