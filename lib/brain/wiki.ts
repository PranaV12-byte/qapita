import fs from "node:fs";
import path from "node:path";
import { PILLARS, getNode, getPillar } from "../content/tree";
import { loadArticle, loadAllArticles } from "../content/loader";
import { GENERAL_NODE_ID, GENERAL_NODE_TITLE } from "../rag/config";
import { brainStore, type BrainStore, type BrainAnswer, type BrainManifest } from "./store";
import { loadGraph, type BrainGraph } from "./weave";
import type { ChunkMeta } from "../rag/types";

// ── The wiki page model (SPEC-VAULT.md V1) ──────────────────────────────────────
// Turns any note id — a curated topic, a user-uploaded source, a brain-local
// u-node, the general bucket, or a pillar index — into a readable page:
// { kind, title, meta, markdown, backlinks[] }. Topics combine the curated
// article, the user's own attributed passages ("## From your sources"), and the
// LLM/template synthesis (wiki/<nodeId>.md). Read-only: this module never writes
// under data/brains/** (weave.ts owns synthesis authoring). Works with a null
// brainId too — foundation topics/pillars are readable before any upload.

export type NoteKind = "topic" | "source" | "user-node" | "general" | "pillar";
export type BacklinkKind = NoteKind | "answer";

export type Backlink = {
  id: string;
  kind: BacklinkKind;
  title: string;
  snippet: string;
};

export type NotePage = {
  id: string;
  kind: NoteKind;
  title: string;
  meta: Record<string, string | number>;
  markdown: string;
  backlinks: Backlink[];
};

export type BuildNoteOpts = { store?: BrainStore };

const SNIPPET_MAX = 140;
const PASSAGES_PER_SOURCE = 12;

function snip(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, SNIPPET_MAX);
}

/** Curated articles wrap some sections in MDX components (e.g. `<Advanced>`).
 *  The note pane renders plain markdown, not MDX, so we unwrap capitalized
 *  component tags — keeping the inner content, dropping only the tags — rather
 *  than leaking `<Advanced>` into the reader. Standard markdown is untouched. */
function stripMdxComponents(md: string): string {
  return md
    .replace(/<\/?[A-Z][A-Za-z0-9]*(?:\s[^>]*)?\/?>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function kindOf(id: string): NoteKind {
  if (id.startsWith("pillar:")) return "pillar";
  if (id.startsWith("source:")) return "source";
  if (id === GENERAL_NODE_ID) return "general";
  if (id.startsWith("u-")) return "user-node";
  return "topic";
}

type Ctx = { manifest: BrainManifest | null; graph: BrainGraph };

function noteTitleOf(id: string, ctx: Ctx): string | undefined {
  if (id.startsWith("pillar:")) return getPillar(id.slice("pillar:".length))?.title;
  if (id.startsWith("source:")) return ctx.manifest?.sources[id.slice("source:".length)]?.fileName;
  if (id === GENERAL_NODE_ID) return GENERAL_NODE_TITLE;
  if (id.startsWith("u-")) return ctx.graph.userNodes[id]?.title;
  return getNode(id)?.title;
}

function loadDeltaEntries(store: BrainStore, brainId: string): ChunkMeta[] {
  const p = path.join(store.brainPaths(brainId).dir, "chunks.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as ChunkMeta[];
  } catch {
    return [];
  }
}

function readWikiNote(store: BrainStore, brainId: string, nodeId: string): string | null {
  const p = path.join(store.brainPaths(brainId).dir, "wiki", `${nodeId}.md`);
  if (!fs.existsSync(p)) return null;
  try {
    const md = fs.readFileSync(p, "utf-8").trim();
    return md || null;
  } catch {
    return null;
  }
}

function readAnswers(store: BrainStore, brainId: string): BrainAnswer[] {
  const { answersPath } = store.brainPaths(brainId);
  if (!fs.existsSync(answersPath)) return [];
  return fs
    .readFileSync(answersPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as BrainAnswer];
      } catch {
        return [];
      }
    });
}

/** Group a node's passages by source and render them as attributed blockquotes
 *  ("## From your sources"). User content is quotable back to the same user
 *  WITH attribution (CLAUDE.md rule #5). Truncation is never silent. */
function renderFromSources(entries: ChunkMeta[], manifest: BrainManifest | null): string {
  const bySource = new Map<string, ChunkMeta[]>();
  for (const e of entries) {
    const key = e.sourceId ?? "unknown";
    const arr = bySource.get(key);
    if (arr) arr.push(e);
    else bySource.set(key, [e]);
  }
  const blocks = [...bySource].map(([sid, es]) => {
    const name = manifest?.sources[sid]?.fileName ?? es[0]?.title ?? "Your source";
    const shown = es.slice(0, PASSAGES_PER_SOURCE);
    const quotes = shown.map((e) => `> ${e.text.replace(/\s+/g, " ").trim()}`).join("\n>\n");
    const more =
      es.length > PASSAGES_PER_SOURCE
        ? `\n\n_+${es.length - PASSAGES_PER_SOURCE} more passage(s) from this source._`
        : "";
    return `**${name}**\n\n${quotes}${more}`;
  });
  return `## From your sources\n\n${blocks.join("\n\n")}`;
}

/** Other wiki notes in this brain whose body contains `[[<title>]]`. */
function scanWikiMentions(
  store: BrainStore,
  brainId: string | null,
  id: string,
  title: string,
  ctx: Ctx
): Backlink[] {
  if (!brainId) return [];
  const wikiDir = path.join(store.brainPaths(brainId).dir, "wiki");
  if (!fs.existsSync(wikiDir)) return [];
  const needle = `[[${title}]]`;
  const out: Backlink[] = [];
  for (const file of fs.readdirSync(wikiDir)) {
    if (!file.endsWith(".md")) continue;
    const stem = file.slice(0, -3);
    if (stem === id) continue;
    let content: string;
    try {
      content = fs.readFileSync(path.join(wikiDir, file), "utf-8");
    } catch {
      continue;
    }
    const idx = content.indexOf(needle);
    if (idx < 0) continue;
    out.push({
      id: stem,
      kind: kindOf(stem),
      title: noteTitleOf(stem, ctx) ?? stem,
      snippet: snip(content.slice(Math.max(0, idx - 60), idx + needle.length + 60)),
    });
  }
  return out;
}

function dedupe(links: Backlink[]): Backlink[] {
  const seen = new Set<string>();
  const out: Backlink[] = [];
  for (const l of links) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    out.push(l);
  }
  return out;
}

export async function buildNotePage(
  brainId: string | null,
  id: string,
  opts: BuildNoteOpts = {}
): Promise<NotePage | null> {
  const store = opts.store ?? brainStore;
  const kind = kindOf(id);
  const graph = brainId ? loadGraph(brainId, { store }) : { userNodes: {}, edges: [], crossLinks: [], nodeSummaries: {} };
  const manifest = brainId ? store.loadManifest(brainId) : null;
  const ctx: Ctx = { manifest, graph };
  const answers = brainId ? readAnswers(store, brainId) : [];

  // ── pillar → an index of its topics as [[links]] ──
  if (kind === "pillar") {
    const pillar = getPillar(id.slice("pillar:".length));
    if (!pillar) return null;
    const markdown = [
      `Topics in this pillar:`,
      ``,
      ...pillar.nodes.map((n) => `- [[${n.title}]]`),
    ].join("\n");
    return { id, kind, title: pillar.title, meta: { topics: pillar.nodes.length }, markdown, backlinks: [] };
  }

  // ── source → its extracted markdown verbatim ──
  if (kind === "source") {
    if (!brainId) return null;
    const sourceId = id.slice("source:".length);
    const meta = manifest?.sources[sourceId];
    if (!meta) return null;
    const extractedPath = path.join(store.brainPaths(brainId).dir, "sources", sourceId, "extracted.md");
    const markdown = fs.existsSync(extractedPath) ? fs.readFileSync(extractedPath, "utf-8") : "";

    const backlinks: Backlink[] = [];
    for (const nid of meta.nodeIds) {
      backlinks.push({
        id: nid,
        kind: kindOf(nid),
        title: noteTitleOf(nid, ctx) ?? nid,
        snippet: snip(graph.nodeSummaries[nid] ?? ""),
      });
    }
    for (const a of answers) {
      if (a.citations.some((c) => c.sourceId === sourceId)) {
        backlinks.push({ id: `answer:${a.artifactId}`, kind: "answer", title: a.title || a.query, snippet: snip(a.query) });
      }
    }
    return {
      id,
      kind,
      title: meta.fileName,
      meta: {
        format: meta.format,
        passages: meta.passageCount,
        added: meta.addedAt,
        feeds: meta.nodeIds.join(", ") || "(none)",
      },
      markdown,
      backlinks: dedupe(backlinks),
    };
  }

  // ── topic | user-node | general ──
  const title = noteTitleOf(id, ctx);
  if (!title) return null;

  const entries = brainId ? loadDeltaEntries(store, brainId).filter((e) => e.nodeId === id) : [];
  const synthesis = brainId ? readWikiNote(store, brainId, id) : null;

  const parts: string[] = [];
  if (kind === "topic") {
    const node = getNode(id);
    if (node) {
      const art = await loadArticle(node.pillarSlug, node.slug);
      if (art) parts.push(stripMdxComponents(art.content));
    }
    if (entries.length) parts.push(renderFromSources(entries, manifest));
    if (synthesis) parts.push(`## Synthesis\n\n${synthesis}`);
  } else {
    // user-node / general: synthesis leads, then the attributed passages.
    if (synthesis) parts.push(`## Synthesis\n\n${synthesis}`);
    if (entries.length) parts.push(renderFromSources(entries, manifest));
  }

  const markdown = parts.join("\n\n").trim() || `_No content yet for ${title}._`;

  // ── backlinks: feeding sources · crossLinks · curated related · answers · [[mentions]] ──
  const backlinks: Backlink[] = [];

  const feedingSourceIds = [...new Set(graph.edges.filter((e) => e.nodeId === id).map((e) => e.sourceId))];
  for (const sid of feedingSourceIds) {
    backlinks.push({
      id: `source:${sid}`,
      kind: "source",
      title: manifest?.sources[sid]?.fileName ?? "Your source",
      snippet: snip(entries.find((e) => e.sourceId === sid)?.text ?? ""),
    });
  }

  for (const l of graph.crossLinks) {
    const other = l.a === id ? l.b : l.b === id ? l.a : null;
    if (!other) continue;
    backlinks.push({
      id: other,
      kind: kindOf(other),
      title: noteTitleOf(other, ctx) ?? other,
      snippet: snip(graph.nodeSummaries[other] ?? ""),
    });
  }

  if (kind === "topic") {
    const articles = await loadAllArticles();
    const related = new Set<string>();
    articles.find((a) => a.frontmatter.id === id)?.frontmatter.related.forEach((r) => related.add(r));
    for (const a of articles) if (a.frontmatter.related.includes(id)) related.add(a.frontmatter.id);
    related.delete(id);
    for (const r of related) {
      const t = getNode(r)?.title;
      if (!t) continue;
      backlinks.push({
        id: r,
        kind: "topic",
        title: t,
        snippet: snip(articles.find((a) => a.frontmatter.id === r)?.frontmatter.summaryPlain ?? ""),
      });
    }
  }

  for (const a of answers) {
    if (a.citations.some((c) => c.nodeId === id)) {
      backlinks.push({ id: `answer:${a.artifactId}`, kind: "answer", title: a.title || a.query, snippet: snip(a.query) });
    }
  }

  backlinks.push(...scanWikiMentions(store, brainId, id, title, ctx));

  const sourceCount = new Set(entries.map((e) => e.sourceId).filter(Boolean)).size;
  return {
    id,
    kind,
    title,
    meta: { passages: entries.length, sources: sourceCount },
    markdown,
    backlinks: dedupe(backlinks),
  };
}

/** Ids referenced by pillar count — exported for a future site map; kept here
 *  so PILLARS is the single source of truth for the pillar note ids. */
export function allPillarNoteIds(): string[] {
  return PILLARS.map((p) => `pillar:${p.slug}`);
}
