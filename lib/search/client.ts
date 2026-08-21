import MiniSearch, { type SearchResult } from "minisearch";
import {
  SEARCH_FIELDS,
  SEARCH_STORE_FIELDS,
  type SearchDoc,
} from "./types";
import { ALL_NODES, getPillar } from "@/lib/content/tree";

export type SearchHit = SearchResult & {
  title: string;
  path: string;
  type: SearchDoc["type"];
  pillar?: string;
  summary: string;
};

let docsPromise: Promise<SearchDoc[]> | null = null;

const plannedTopicDocs: SearchDoc[] = ALL_NODES
  .filter((node) => node.contentState === "planned")
  .map((node) => ({
    id: `t-${node.id}`,
    type: "topic" as const,
    title: node.title,
    path: `/p/${node.pillarSlug}`,
    pillar: getPillar(node.pillarSlug)?.title,
    summary: "A planned library topic. Guidance is being prepared.",
    text: `${node.title} ${getPillar(node.pillarSlug)?.title ?? ""}`,
  }));

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
