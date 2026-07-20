export type SearchDoc = {
  id: string;
  type: "article" | "glossary";
  title: string;
  path: string;
  pillar?: string;
  summary: string;
  text: string;
};

/** MiniSearch config shared by the build script and the client. */
export const SEARCH_FIELDS = ["title", "summary", "text"] as const;
export const SEARCH_STORE_FIELDS = [
  "title",
  "path",
  "type",
  "pillar",
  "summary",
] as const;
