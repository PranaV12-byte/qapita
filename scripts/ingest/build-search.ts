import fs from "node:fs";
import path from "node:path";
import { loadAllArticles } from "../../lib/content/loader";
import { loadGlossary } from "../../lib/content/glossary";
import { getNode, getPillar } from "../../lib/content/tree";
import type { SearchDoc } from "../../lib/search/types";

/** Strip MDX/markdown noise so the search body is plain prose. */
function toPlainText(mdx: string): string {
  return mdx
    .replace(/<\/?[A-Za-z][^>]*>/g, " ") // JSX tags (e.g. <Advanced>)
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/[*_`>#-]/g, " ") // markdown marks
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const docs: SearchDoc[] = [];

  const articles = await loadAllArticles();
  for (const { frontmatter, content } of articles) {
    const node = getNode(frontmatter.id);
    if (!node) continue;
    const pillar = getPillar(node.pillarSlug);
    docs.push({
      id: `a-${frontmatter.id}`,
      type: "article",
      title: frontmatter.title,
      path: `/a/${node.pillarSlug}/${node.slug}`,
      pillar: pillar?.title,
      summary: frontmatter.summaryPlain,
      text: toPlainText(content),
    });
  }

  for (const term of loadGlossary()) {
    docs.push({
      id: `g-${term.slug}`,
      type: "glossary",
      title: term.term,
      path: `/glossary/${term.slug}`,
      summary: term.definition,
      text: term.definition,
    });
  }

  const outDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "search-index.json");
  fs.writeFileSync(outPath, JSON.stringify(docs));
  console.log(
    `[search] wrote ${docs.length} docs (${articles.length} articles + ${
      docs.length - articles.length
    } glossary) → ${outPath}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
