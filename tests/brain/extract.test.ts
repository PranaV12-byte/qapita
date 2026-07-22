import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { extractDocument } from "@/lib/brain/extract";
import { BRAIN_MAX_FILE_MB } from "@/lib/rag/config";

const GOOD = path.join(process.cwd(), "tests", "fixtures", "brain", "good");
const PATH_ = path.join(process.cwd(), "tests", "fixtures", "brain", "pathological");

function loadFixture(dir: string, name: string): Buffer {
  return fs.readFileSync(path.join(dir, name));
}

describe("extractDocument: good fixtures extract non-empty markdown with a sane title", () => {
  const cases = [
    "equity-note.md",
    "equity-note.txt",
    "equity-note.csv",
    "equity-note.tsv",
    "equity-note.json",
    "equity-note.html",
    "equity-note.docx",
    "equity-note.xlsx",
    "equity-note.pdf",
  ];

  it.each(cases)("%s", async (name) => {
    const buffer = loadFixture(GOOD, name);
    const result = await extractDocument(name, buffer);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.markdown.trim().length).toBeGreaterThan(0);
      expect(result.title.trim().length).toBeGreaterThan(0);
      expect(result.title).not.toBe("Untitled");
      expect(result.meta.sizeBytes).toBeGreaterThan(0);
    }
  });
});

describe("extractDocument: pathological content fixtures that ARE extraction-valid text", () => {
  // These live under pathological/ because they're health-check concerns
  // (off-topic, duplicate, non-English) — not extraction failures. extract.ts
  // itself should succeed on all of them.
  const cases = ["off-topic.md", "non-english.md", "near-duplicate-a.md", "near-duplicate-b.md"];

  it.each(cases)("%s extracts fine (not extract.ts's concern)", async (name) => {
    const buffer = loadFixture(PATH_, name);
    const result = await extractDocument(name, buffer);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.markdown.trim().length).toBeGreaterThan(0);
  });
});

describe("extractDocument: each pathological case maps to its distinct failure code", () => {
  it("empty.md -> empty_file", async () => {
    const result = await extractDocument("empty.md", loadFixture(PATH_, "empty.md"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("empty_file");
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("whitespace-only.md -> empty_extraction", async () => {
    const result = await extractDocument(
      "whitespace-only.md",
      loadFixture(PATH_, "whitespace-only.md")
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("empty_extraction");
  });

  it("binary-blob.md -> binary_content", async () => {
    const result = await extractDocument(
      "binary-blob.md",
      loadFixture(PATH_, "binary-blob.md")
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("binary_content");
  });

  it("rejected.rtf -> unsupported_format", async () => {
    const result = await extractDocument("rejected.rtf", loadFixture(PATH_, "rejected.rtf"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unsupported_format");
      expect(result.message).toMatch(/not a supported format/i);
    }
  });

  it("rejected.doc -> unsupported_format (extension-gated, content never parsed)", async () => {
    const result = await extractDocument("rejected.doc", loadFixture(PATH_, "rejected.doc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unsupported_format");
  });

  it("an unlisted extension -> unsupported_format", async () => {
    const result = await extractDocument("notes.xyz", Buffer.from("hello"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unsupported_format");
  });

  it("scanned-image.pdf (no text layer) -> no_text_layer, with the honest OCR wording", async () => {
    const result = await extractDocument(
      "scanned-image.pdf",
      loadFixture(PATH_, "scanned-image.pdf")
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("no_text_layer");
      expect(result.message).toMatch(/ocr/i);
    }
  });

  it("a file over BRAIN_MAX_FILE_MB -> file_too_large (synthesized, not committed)", async () => {
    const oversize = Buffer.alloc(BRAIN_MAX_FILE_MB * 1024 * 1024 + 1024, "a");
    const result = await extractDocument("huge.md", oversize);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("file_too_large");
      expect(result.message).toMatch(new RegExp(`${BRAIN_MAX_FILE_MB}MB`));
    }
  });

  it("malformed JSON -> parse_failed", async () => {
    const result = await extractDocument("broken.json", Buffer.from("{ not valid json"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("parse_failed");
  });

  it("garbage bytes with a .docx extension -> parse_failed", async () => {
    const result = await extractDocument(
      "corrupt.docx",
      Buffer.from([0x50, 0x4b, 0x99, 0x99, 0x01, 0x02, 0x03])
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("parse_failed");
  });

  it("garbage bytes with a .xlsx extension -> parse_failed", async () => {
    const result = await extractDocument(
      "corrupt.xlsx",
      Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44])
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("parse_failed");
  });
});

describe("extractDocument: CSV/TSV/JSON specifics", () => {
  it("renders CSV as a markdown table", async () => {
    const result = await extractDocument("t.csv", Buffer.from("a,b\n1,2\n3,4"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.markdown).toContain("| a | b |");
      expect(result.markdown).toContain("| 1 | 2 |");
    }
  });

  it("handles a quoted CSV field containing a comma", async () => {
    const result = await extractDocument(
      "t.csv",
      Buffer.from('name,note\n"Smith, Jane","says ""hi"""')
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.markdown).toContain("Smith, Jane");
      expect(result.markdown).toContain('says "hi"');
    }
  });

  it("renders TSV as a markdown table", async () => {
    const result = await extractDocument("t.tsv", Buffer.from("a\tb\n1\t2"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.markdown).toContain("| a | b |");
  });

  it("flattens nested JSON to dot-path lines", async () => {
    const result = await extractDocument(
      "t.json",
      Buffer.from(JSON.stringify({ topic: "RSUs", notes: ["a", "b"] }))
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.markdown).toContain("topic: RSUs");
      expect(result.markdown).toContain("notes.0: a");
      expect(result.markdown).toContain("notes.1: b");
    }
  });
});

describe("extractDocument: markdown frontmatter", () => {
  it("strips frontmatter and prefers its title", async () => {
    const md = ["---", "title: Frontmatter Title", "---", "", "Body text here."].join("\n");
    const result = await extractDocument("t.md", Buffer.from(md));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.title).toBe("Frontmatter Title");
      expect(result.markdown).not.toContain("---");
      expect(result.markdown).toContain("Body text here.");
    }
  });
});
