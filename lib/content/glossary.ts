import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getNode } from "./tree";

export const GlossaryTermSchema = z.object({
  term: z.string(),
  slug: z.string(),
  definition: z.string(),
  appearsIn: z.array(z.string()),
});

export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

const GLOSSARY_PATH = path.join(
  process.cwd(),
  "content",
  "glossary",
  "terms.json"
);

let cache: GlossaryTerm[] | null = null;

export function loadGlossary(): GlossaryTerm[] {
  if (cache) return cache;
  if (!fs.existsSync(GLOSSARY_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(GLOSSARY_PATH, "utf-8"));
  const terms = z.array(GlossaryTermSchema).parse(raw);
  // Keep only appearsIn ids that map to real nodes, then sort A–Z.
  cache = terms
    .map((t) => ({
      ...t,
      appearsIn: t.appearsIn.filter((id) => getNode(id)),
    }))
    .sort((a, b) => a.term.localeCompare(b.term));
  return cache;
}

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return loadGlossary().find((t) => t.slug === slug);
}
