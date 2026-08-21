"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Draft = { id: number; query: string; result: { title: string } };

export default function ArchivePage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  useEffect(() => {
    try {
      const value = sessionStorage.getItem("equityiq:drafts");
      if (value) setDrafts(JSON.parse(value) as Draft[]);
    } catch { setDrafts([]); }
  }, []);
  return <div className="v9-page"><header className="v9-page-header"><h1>Archive</h1><p>Your recent draft work in this browser.</p></header><div className="v9-content"><div className="v9-archive-list">{drafts.map((draft) => <Link key={draft.id} href={`/generate?q=${encodeURIComponent(draft.query)}`}><small>Draft request</small><strong>{draft.result.title || draft.query}</strong><span>{draft.query}</span></Link>)}{drafts.length === 0 && <div className="v9-archive-empty"><h2>No drafts yet</h2><p>When you prepare a draft, it will appear here for this browser session.</p><Link href="/generate">Ask a question →</Link></div>}</div></div></div>;
}
