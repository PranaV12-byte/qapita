import path from "node:path";
import matter from "gray-matter";
import { extractTitleAndLead } from "../rag/textProbe";
import { BRAIN_MAX_FILE_MB } from "../rag/config";

type SpreadsheetSheet = { sheet: string; data: unknown[][] };

/**
 * Converts an uploaded file into plain Markdown without writing to a Brain or
 * calling a network service. Typed failures let the upload flow explain what
 * went wrong, while lazy parsers avoid loading file-format libraries needlessly.
 */

export type ExtractFailureCode =
  | "unsupported_format"
  | "file_too_large"
  | "binary_content"
  | "empty_file"
  | "no_text_layer"
  | "empty_extraction"
  | "password_protected"
  | "parse_failed";

export type ExtractSuccess = {
  ok: true;
  title: string;
  markdown: string;
  meta: { format: string; sizeBytes: number };
};

export type ExtractFailure = {
  ok: false;
  code: ExtractFailureCode;
  message: string;
};

export type ExtractResult = ExtractSuccess | ExtractFailure;

const ACCEPTED_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".pdf",
  ".docx",
  ".csv",
  ".tsv",
  ".xlsx",
  ".html",
  ".htm",
  ".json",
]);

const TEXTUAL_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".csv",
  ".tsv",
  ".html",
  ".htm",
  ".json",
]);

const MAX_TABLE_ROWS = 2000;
const MAX_JSON_CHARS = 200_000;
const MAX_JSON_DEPTH = 6;

function ok(title: string, markdown: string, format: string): ExtractSuccess {
  return {
    ok: true,
    title: title || "Untitled",
    markdown,
    meta: { format, sizeBytes: Buffer.byteLength(markdown, "utf-8") },
  };
}

function fail(code: ExtractFailureCode, message: string): ExtractFailure {
  return { ok: false, code, message };
}

function titleFromFileName(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  return base.replace(/[-_]+/g, " ").trim() || "Untitled";
}

function titleFromFirstLine(text: string, fileName: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return firstLine ? firstLine.slice(0, 120) : titleFromFileName(fileName);
}

/** Presence of a NUL byte in the first few KB is the standard binary sniff
 *  (same heuristic `git` uses) — cheap and catches the real pathological case
 *  (a binary blob renamed to a text extension) without over-engineering a
 *  full byte-distribution analysis. */
function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  return sample.includes(0);
}

/** Node's Buffer#toString("utf-8") never throws — it silently substitutes
 *  U+FFFD for invalid sequences. That substitution is the correct signal to
 *  retry as latin1 rather than keep mangled text. */
function decodeText(buffer: Buffer): string {
  const utf8 = buffer.toString("utf-8");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}

// ── Lazy loaders with defensive CJS/ESM interop unwrap ──────────────────────────
// unpdf ships proper named ESM exports (confirmed via its own .d.ts) — no
// unwrap needed. mammoth/turndown are CJS; whether a bundler's dynamic
// import() surfaces their exports directly or behind `.default` isn't
// guaranteed across bundlers, so each checks for the member it actually needs
// and falls back to `.default` — the same defensive pattern proven in the
// Earlier compatibility checks used plain require() and confirmed both shapes work.

async function loadMammoth(): Promise<{
  extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
}> {
  const mod = (await import("mammoth")) as unknown as Record<string, unknown>;
  return (mod.extractRawText ? mod : (mod.default as Record<string, unknown>)) as {
    extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
  };
}

async function loadTurndownService(): Promise<new () => { turndown(html: string): string }> {
  const mod = (await import("turndown")) as unknown as Record<string, unknown>;
  return (mod.default ?? mod) as new () => { turndown(html: string): string };
}

// ── Per-format extractors ────────────────────────────────────────────────────────

async function extractPdf(buffer: Buffer, fileName: string): Promise<ExtractResult> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const msg = err instanceof Error ? err.message : String(err);
    if (/password/i.test(name) || /password/i.test(msg)) {
      return fail(
        "password_protected",
        "This PDF is password-protected and can't be opened without the password."
      );
    }
    throw err;
  }
  const { text } = await extractText(pdf, { mergePages: true });
  if (text.trim().length === 0) {
    return fail(
      "no_text_layer",
      "No extractable text was found — this looks like a scanned or image-only PDF. OCR isn't supported."
    );
  }
  return ok(titleFromFirstLine(text, fileName), text, "pdf");
}

async function extractDocx(buffer: Buffer, fileName: string): Promise<ExtractResult> {
  const mammoth = await loadMammoth();
  const { value } = await mammoth.extractRawText({ buffer });
  if (value.trim().length === 0) {
    return fail("empty_extraction", "No extractable text was found in this document.");
  }
  return ok(titleFromFirstLine(value, fileName), value, "docx");
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return String(v.result ?? "");
  }
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

async function extractXlsx(buffer: Buffer, fileName: string): Promise<ExtractResult> {
  const { default: readWorkbook } = await import("read-excel-file/node");
  const sheets = (await readWorkbook(buffer)) as SpreadsheetSheet[];

  const sections: string[] = [];
  let rowsEmitted = 0;
  for (const worksheet of sheets) {
    if (rowsEmitted >= MAX_TABLE_ROWS) break;
    const lines: string[] = [`## ${worksheet.sheet}`, ""];
    for (const row of worksheet.data) {
      if (rowsEmitted >= MAX_TABLE_ROWS) break;
      lines.push("| " + row.map(cellToText).join(" | ") + " |");
      rowsEmitted++;
    }
    if (lines.length > 2) sections.push(lines.join("\n"));
  }

  const markdown = sections.join("\n\n");
  if (markdown.trim().length === 0) {
    return fail("empty_extraction", "No data was found in this spreadsheet.");
  }
  const note =
    rowsEmitted >= MAX_TABLE_ROWS ? `\n\n_(truncated to ${MAX_TABLE_ROWS} rows)_` : "";
  return ok(titleFromFileName(fileName), markdown + note, "xlsx");
}

async function extractHtml(text: string, fileName: string): Promise<ExtractResult> {
  const TurndownService = await loadTurndownService();
  const turndown = new TurndownService();
  const markdown = turndown.turndown(text);
  if (markdown.trim().length === 0) {
    return fail("empty_extraction", "No text content was found in this HTML file.");
  }
  const { title: h1Title } = extractTitleAndLead(markdown);
  return ok(h1Title || titleFromFileName(fileName), markdown, "html");
}

/** Single-line delimited-field splitter with minimal quoted-field support
 *  ("" as an escaped quote). Not a full RFC4180 parser — doesn't handle a
 *  quoted field spanning multiple lines — which is proportionate for "native,
 *  no new dependency" handling of straightforward uploaded spreadsheets. */
function splitDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"' && cur === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function extractDelimited(text: string, fileName: string, delimiter: string): ExtractResult {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return fail("empty_extraction", "No rows were found in this file.");
  }
  const capped = lines.slice(0, MAX_TABLE_ROWS);
  const rows = capped.map((l) => splitDelimitedLine(l, delimiter));
  const header = rows[0];
  const mdLines = [
    "| " + header.join(" | ") + " |",
    "| " + header.map(() => "---").join(" | ") + " |",
    ...rows.slice(1).map((r) => "| " + r.join(" | ") + " |"),
  ];
  const note =
    lines.length > MAX_TABLE_ROWS ? `\n\n_(truncated to ${MAX_TABLE_ROWS} rows)_` : "";
  return ok(titleFromFileName(fileName), mdLines.join("\n") + note, delimiter === "," ? "csv" : "tsv");
}

/** Flattens arbitrary JSON to "dot.path: value" lines — simple and always
 *  flat (no nested-indentation edge cases), still fully readable/chunkable. */
function prettyJson(value: unknown, keyPath: string[] = [], depth = 0): string[] {
  const label = keyPath.join(".") || "value";
  if (depth >= MAX_JSON_DEPTH) return [`${label}: …`];
  if (value === null || value === undefined) return [`${label}: null`];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${label}: []`];
    return value.flatMap((v, i) => prettyJson(v, [...keyPath, String(i)], depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return [`${label}: {}`];
    return entries.flatMap(([k, v]) => prettyJson(v, [...keyPath, k], depth + 1));
  }
  return [`${label}: ${String(value)}`];
}

function extractJson(text: string, fileName: string): ExtractResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("parse_failed", "This file is not valid JSON.");
  }
  const rendered = prettyJson(parsed).join("\n");
  if (rendered.trim().length === 0) {
    return fail("empty_extraction", "No content was found in this JSON file.");
  }
  const markdown =
    rendered.length > MAX_JSON_CHARS ? rendered.slice(0, MAX_JSON_CHARS) + "\n\n_(truncated)_" : rendered;
  return ok(titleFromFileName(fileName), markdown, "json");
}

function extractPlainOrMarkdown(
  text: string,
  fileName: string,
  format: "markdown" | "text"
): ExtractResult {
  let content = text;
  let frontmatterTitle: string | undefined;
  try {
    const parsed = matter(text);
    content = parsed.content;
    if (typeof parsed.data?.title === "string") frontmatterTitle = parsed.data.title;
  } catch {
    content = text; // malformed frontmatter delimiters — fall back to the raw text.
  }
  if (content.trim().length === 0) {
    return fail("empty_extraction", "This file has no content.");
  }
  const { title: h1Title } = extractTitleAndLead(content);
  return ok(frontmatterTitle || h1Title || titleFromFileName(fileName), content, format);
}

// ── Entry point ──────────────────────────────────────────────────────────────────

export async function extractDocument(fileName: string, buffer: Buffer): Promise<ExtractResult> {
  const ext = path.extname(fileName).toLowerCase();

  if (!ACCEPTED_EXTENSIONS.has(ext)) {
    return fail(
      "unsupported_format",
      `"${ext || "(no extension)"}" is not a supported format. Accepted: ${[...ACCEPTED_EXTENSIONS].join(", ")}.`
    );
  }
  if (buffer.length === 0) {
    return fail("empty_file", "The file is empty.");
  }
  const maxBytes = BRAIN_MAX_FILE_MB * 1024 * 1024;
  if (buffer.length > maxBytes) {
    return fail(
      "file_too_large",
      `The file is ${(buffer.length / (1024 * 1024)).toFixed(1)}MB, over the ${BRAIN_MAX_FILE_MB}MB limit.`
    );
  }

  try {
    if (TEXTUAL_EXTENSIONS.has(ext)) {
      if (looksBinary(buffer)) {
        return fail("binary_content", "This file contains binary data, not readable text.");
      }
      const text = decodeText(buffer);
      switch (ext) {
        case ".md":
        case ".markdown":
          return extractPlainOrMarkdown(text, fileName, "markdown");
        case ".txt":
          return extractPlainOrMarkdown(text, fileName, "text");
        case ".csv":
          return extractDelimited(text, fileName, ",");
        case ".tsv":
          return extractDelimited(text, fileName, "\t");
        case ".json":
          return extractJson(text, fileName);
        case ".html":
        case ".htm":
          return await extractHtml(text, fileName);
      }
    }
    switch (ext) {
      case ".pdf":
        return await extractPdf(buffer, fileName);
      case ".docx":
        return await extractDocx(buffer, fileName);
      case ".xlsx":
        return await extractXlsx(buffer, fileName);
    }
    /* c8 ignore next -- unreachable given the allowlist check above */
    return fail("unsupported_format", "Unsupported format.");
  } catch (err) {
    return fail("parse_failed", `Could not parse this file: ${err instanceof Error ? err.message : String(err)}`);
  }
}
