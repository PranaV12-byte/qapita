import { CHUNK_MAX_CHARS, CHUNK_OVERLAP } from "./config";

// ── Leaf splitter ───────────────────────────────────────────────────────────────
// Paragraph-boundary splitter with overlap. Used as the leaf step *inside* the
// heading-aware chunker, so section bodies that are too long get split further.

export function splitLeaf(
  text: string,
  maxChars = CHUNK_MAX_CHARS,
  overlap = CHUNK_OVERLAP
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const rawParagraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // A paragraph longer than maxChars can't be hard-truncated — that both
  // drops its tail content and cuts mid-word (e.g. "...ordinar" |
  // "y compensation..."). Break it at the last word boundary before the
  // limit instead, so every piece the accumulation loop below sees already
  // fits and nothing is lost.
  const paragraphs: string[] = [];
  for (const para of rawParagraphs) {
    if (para.length <= maxChars) {
      paragraphs.push(para);
      continue;
    }
    let rest = para;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(" ", maxChars);
      const at = cut > 0 ? cut : maxChars;
      paragraphs.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) paragraphs.push(rest);
  }

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (!current) {
      current = para;
      continue;
    }
    const joined = current + "\n\n" + para;
    if (joined.length <= maxChars) {
      current = joined;
    } else {
      chunks.push(current);
      // A raw character-count slice can land mid-word; drop any partial
      // leading word so the overlap always starts clean.
      const tail = current.slice(-overlap).replace(/^\S*/, "").trimStart();
      current = tail ? `${tail}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ── Heading-aware markdown chunker ────────────────────────────────────────────────

export type ChunkResult = {
  text: string;
  headingPath: string;
  parentId: string;
};

export type SectionResult = {
  parentId: string;
  headingPath: string;
  title: string;
  text: string;
};

export type ChunkedDoc = {
  title: string;
  chunks: ChunkResult[];
  sections: SectionResult[];
};

export type ChunkOpts = {
  /** Stable, unique prefix for parentIds (e.g. the file's relative path). */
  docId?: string;
  /** Title override; otherwise derived from the first H1. */
  title?: string;
  maxChars?: number;
  overlap?: number;
};

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^\s*(```+|~~~+)/;

/**
 * Split markdown into small chunks, each tagged with its heading path and a
 * parentId pointing at the full section it came from. Fenced code blocks are
 * skipped so a `#` inside a code sample is never mistaken for a heading.
 * Files with no headings fall back to a single whole-document section.
 */
export function chunkMarkdown(
  markdown: string,
  opts: ChunkOpts = {}
): ChunkedDoc {
  const maxChars = opts.maxChars ?? CHUNK_MAX_CHARS;
  const overlap = opts.overlap ?? CHUNK_OVERLAP;

  const lines = markdown.split(/\r?\n/);
  const stack: { level: number; text: string }[] = [];
  let inFence = false;
  let fenceChar = "";
  // H1 (if any) is the canonical title; opts.title is only a fallback.
  let h1Title = "";

  type RawSection = { headingPath: string; lines: string[] };
  const sections: RawSection[] = [];
  let current: RawSection | null = null;

  const headingPath = () => stack.map((s) => s.text).join(" > ");
  const flush = () => {
    if (current && current.lines.join("\n").trim()) sections.push(current);
    current = null;
  };

  for (const line of lines) {
    const fence = line.match(FENCE_RE);
    if (fence) {
      const ch = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
        fenceChar = "";
      }
      if (current) current.lines.push(line);
      continue;
    }

    if (!inFence) {
      const h = line.match(HEADING_RE);
      if (h) {
        const level = h[1].length;
        const text = h[2].trim();
        if (!h1Title && level === 1) h1Title = text;
        while (stack.length && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        stack.push({ level, text });
        flush();
        current = { headingPath: headingPath(), lines: [] };
        continue;
      }
    }

    if (!current) current = { headingPath: headingPath(), lines: [] };
    current.lines.push(line);
  }
  flush();

  const title = h1Title || opts.title || "Untitled";

  // Headingless document → one whole-doc section.
  if (sections.length === 0) {
    const whole = markdown.trim();
    if (whole) sections.push({ headingPath: title, lines: [whole] });
  }

  const docId = opts.docId ?? title;
  const chunks: ChunkResult[] = [];
  const sectionResults: SectionResult[] = [];

  sections.forEach((sec, idx) => {
    const bodyText = sec.lines.join("\n").trim();
    if (!bodyText) return;
    const parentId = `${docId}#${idx}`;
    const hp = sec.headingPath || title;
    sectionResults.push({ parentId, headingPath: hp, title, text: bodyText });
    for (const leaf of splitLeaf(bodyText, maxChars, overlap)) {
      chunks.push({ text: leaf, headingPath: hp, parentId });
    }
  });

  return { title, chunks, sections: sectionResults };
}
