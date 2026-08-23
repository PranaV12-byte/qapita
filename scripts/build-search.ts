import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { PILLARS } from "../lib/content/tree";

const root = process.cwd();
const contentRoot = path.join(root, "content", "pillars");
const outFile = path.join(root, "public", "search-index.json");

type SearchDoc = {
  id: string;
  type: "article" | "glossary";
  title: string;
  path: string;
  pillar?: string;
  summary: string;
  text: string;
};

function cleanText(value: string): string {
  return value.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
}

function main(): void {
  const docs: SearchDoc[] = [];
  for (const pillar of PILLARS) {
    for (const node of pillar.nodes) {
      const filePath = path.join(contentRoot, pillar.slug, `${node.slug}.mdx`);
      if (!fs.existsSync(filePath)) continue;
      const parsed = matter(fs.readFileSync(filePath, "utf8"));
      const title = typeof parsed.data.title === "string" ? parsed.data.title : node.title;
      const summary = typeof parsed.data.summaryPlain === "string" ? parsed.data.summaryPlain : "";
      docs.push({
        id: `a-${node.id}`,
        type: "article",
        title: cleanText(title),
        path: `/a/${pillar.slug}/${node.slug}`,
        pillar: cleanText(pillar.title),
        summary: cleanText(summary),
        text: cleanText(parsed.content),
      });
    }
  }

  const glossaryPath = path.join(root, "content", "glossary", "terms.json");
  if (fs.existsSync(glossaryPath)) {
    const terms = JSON.parse(fs.readFileSync(glossaryPath, "utf8")) as Array<Record<string, string>>;
    for (const term of terms) {
      if (!term.term || !term.slug) continue;
      docs.push({
        id: `g-${term.slug}`,
        type: "glossary",
        title: cleanText(term.term),
        path: `/glossary/${term.slug}`,
        summary: cleanText(term.definition ?? ""),
        text: cleanText(`${term.term} ${term.definition ?? ""} ${term.aliases ?? ""}`),
      });
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(docs));
  console.log(`Built search index with ${docs.length} documents.`);
}

main();
