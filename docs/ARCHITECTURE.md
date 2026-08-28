# Architecture

## Product areas

The application has four main user-facing areas:

- **Ask a Question** (`/generate`) creates grounded answers and supports on-screen, PDF, email, and comparison results.
- **Knowledge Tree** (`/browse`) shows the approved topic structure and points to published guidance.
- **Wiki and glossary** (`/wiki`, `/glossary`, and `/a/...`) contain reviewed, route-validated content.
- **Brain** (`/brain`) lets signed-in users upload and use their own source material.

## How a question becomes an answer

1. The browser sends the query, requested format, and optional context to `/api/artifact`.
2. The server validates the input and retrieves relevant reviewed content. When available, it can also use the signed-in user's Brain material.
3. A grounding step keeps only evidence that is directly relevant to the question.
4. The selected provider creates a structured artifact. If the provider is unavailable, the server uses the controlled fallback path.
5. A final normalizer removes prohibited inline markers and fixes generated formatting before the result is stored or returned.
6. The page renders the answer. PDF and email delivery reuse the validated result instead of generating a different answer.

This separation is deliberate: generated prose can be clean while internal citations, related topics, and Brain backlinks still work.

## Content and retrieval

- Reviewed articles live in `content/pillars` as MDX files.
- Canonical taxonomy data lives in `lib/content`.
- `scripts/build-index` prepares retrieval data.
- `scripts/build-search` prepares the client search index.
- `lib/rag` retrieves and ranks relevant sections for answer generation.

Published routes are built from canonical taxonomy values, not arbitrary frontmatter paths.

## Delivery

- `/api/artifact/pdf` renders a PDF from the same validated answer data.
- `/api/artifact/deliver` requires authenticated delivery and sends the email with a PDF attachment.
- The email and PDF include the original question when it is available, while preserving backward compatibility with older payloads.

## Important boundaries

- Public API request and response shapes should remain compatible unless there is a planned migration.
- Retrieval, generated content, reviewed Wiki content, and user-uploaded Brain sources have different purposes and should not be mixed casually.
- Health checks report configuration status only. They must never expose secret values.
- Environment files and deployment settings are intentionally outside this documentation cleanup.
