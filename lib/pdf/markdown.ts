import { normalizeGeneratedText } from "../llm/output-normalizer";

export type PdfTable = {
  headers: string[];
  rows: string[][];
};

export type PdfBlock =
  | { kind: "heading"; text: string; level: number }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "callout"; text: string }
  | { kind: "table"; table: PdfTable };

function cleanInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTableRow(line: string): string[] {
  const value = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return value.split("|").map((cell) => cleanInline(cell));
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

/** Parse the small Markdown subset emitted by the answer generator without
 * leaving Markdown syntax in the downloadable document. */
export function parsePdfBlocks(bodyMarkdown: string): PdfBlock[] {
  const normalized = normalizeGeneratedText(bodyMarkdown);
  const lines = normalized.split(/\r?\n/);
  const blocks: PdfBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ kind: "heading", text: cleanInline(heading[2]), level: heading[1].length });
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const callout: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        callout.push(lines[index].trim().replace(/^>\s*/, ""));
        index += 1;
      }
      blocks.push({ kind: "callout", text: cleanInline(callout.join(" ")) });
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      if (headers.length > 1 && rows.length > 0) blocks.push({ kind: "table", table: { headers, rows } });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(cleanInline(lines[index].replace(/^\s*[-*]\s+/, "")));
        index += 1;
      }
      blocks.push({ kind: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(cleanInline(lines[index].replace(/^\s*\d+\.\s+/, "")));
        index += 1;
      }
      blocks.push({ kind: "list", ordered: true, items });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,6})\s+/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next) || next.startsWith("> ")) break;
      if (next.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: cleanInline(paragraph.join(" ")) });
  }

  return blocks.filter((block) => block.kind !== "paragraph" || block.text.length > 0);
}
