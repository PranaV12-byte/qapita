import MiniSearch, { type SearchResult } from "minisearch";
import {
  SEARCH_FIELDS,
  SEARCH_STORE_FIELDS,
  type SearchDoc,
} from "./types";
import { V9_TAXONOMY, v9SearchText } from "@/lib/content/v9-taxonomy";

export type SearchHit = SearchResult & {
  title: string;
  path: string;
  type: SearchDoc["type"];
  pillar?: string;
  summary: string;
};

let docsPromise: Promise<SearchDoc[]> | null = null;

const plannedTopicDocs: SearchDoc[] = V9_TAXONOMY.flatMap((group) =>
  group.subtopics.map((topic) => ({
    id: `t-${topic.id}`,
    type: "topic" as const,
    title: topic.name,
    path: `/browse?group=${encodeURIComponent(group.id)}`,
    pillar: group.name,
    summary: group.comingSoon ? "Coming soon." : "Browse this knowledge topic.",
    text: v9SearchText(topic, group),
  }))
);

/** Fetch the prebuilt search index once (cached across calls). */
export function loadSearchDocs(): Promise<SearchDoc[]> {
  if (!docsPromise) {
    docsPromise = fetch("/search-index.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((docs: SearchDoc[]) => [...docs, ...plannedTopicDocs]);
  }
  return docsPromise;
}

export function buildIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const mini = new MiniSearch<SearchDoc>({
    fields: [...SEARCH_FIELDS],
    storeFields: [...SEARCH_STORE_FIELDS],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 3, summary: 2 },
    },
  });
  mini.addAll(docs);
  return mini;
}

export function runSearch(
  index: MiniSearch<SearchDoc>,
  query: string,
  limit = 20
): SearchHit[] {
  if (!query.trim()) return [];
  return index.search(query).slice(0, limit) as SearchHit[];
}
