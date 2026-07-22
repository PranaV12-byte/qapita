# Brain ingest fixtures

Generated in SPEC-BRAIN.md Phase 0 (`.tmp-phase0-spike.cjs`, throwaway, deleted
after use). Covers the accepted-format goods and the pathological matrix from
SPEC-BRAIN.md §5, for Phase 2's extraction + health-check tests.

## `good/` — one accepted-format sample each, on-topic equity-comp content

| File | Format | Generated via |
|---|---|---|
| `equity-note.pdf` | PDF | `@react-pdf/renderer` → verified with `unpdf` |
| `equity-note.docx` | DOCX | hand-rolled minimal STORED zip (`[Content_Types].xml` + `_rels/.rels` + `word/document.xml`) → verified with `mammoth` |
| `equity-note.xlsx` | XLSX | `exceljs` write → verified by `exceljs` read |
| `equity-note.html` | HTML | plain string → verified with `turndown` |
| `equity-note.md` / `.txt` / `.csv` / `.tsv` / `.json` | native formats | hand-authored (no parser dependency; Phase 2 handles these natively) |

## `pathological/` — one fixture per failure/edge mode from §5

| File | Tests |
|---|---|
| `scanned-image.pdf` | real no-text-layer PDF (embedded raster only, built from `public/brand/naspp.png`) — `unpdf` extracts empty/whitespace text |
| `binary-blob.md` | binary bytes (incl. NUL) under a `.md` extension — binary/encoding detection |
| `empty.md` | zero-byte file |
| `whitespace-only.md` | non-empty file, no real content |
| `non-english.md` | genuine French text — the "model is English-centric" warn path, not off-topic |
| `near-duplicate-a.md` / `near-duplicate-b.md` | same topic, reworded — near-duplicate cosine detection |
| `rejected.rtf` | unsupported extension (no maintained pure-JS parser in scope for v1) |
| `rejected.doc` | legacy binary format, extension-gated — content is irrelevant, never parsed |
| `off-topic.md` | clearly unrelated content (a cookie recipe) — off-topic classification. Not one of §5's nine listed cases; added because it directly exercises the on/off-topic classifier Phase 2 builds and cost nothing to include now. |

## Deliberately deferred: password-protected PDF

Not generated in Phase 0. `@react-pdf/renderer` has no encryption/password
support, and hand-rolling the PDF standard security handler (RC4/AES key
derivation per the PDF spec) from memory was judged too high-risk for a
fixture — a subtly wrong implementation would produce a merely-corrupt PDF,
not a genuinely password-protected one, which would test the wrong failure
mode. Phase 2 should source or vendor a small real encrypted PDF (or unit-test
the "requires a password" failure path directly against a simulated
`unpdf`/pdf.js password-required error) before relying on this case.

## Deliberately synthesized at test time, not committed here

Oversize-file rejection (§5) is not a committed fixture — a 15MB+ binary in
the repo is unwarranted bloat. Phase 2 tests should generate an oversized
buffer/string in-test (e.g. a repeated-character string past
`BRAIN_MAX_FILE_MB`) rather than reading a checked-in file.
