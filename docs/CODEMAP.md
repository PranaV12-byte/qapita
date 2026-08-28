# Code map

This is a guide to where application work belongs. It is not a second source of truth: follow the code and tests when they disagree with an older document.

| Folder | What belongs here | Start here when you need to change |
| --- | --- | --- |
| `app` | Next.js pages, layouts, route handlers, and page-specific client state | A URL, page behavior, browser submission, or API endpoint |
| `components` | Reusable visual and interaction pieces | A shared card, form, navigation element, or rendered answer |
| `lib` | Product rules and server-side services | Generation, retrieval, Brain, email, PDF, content, search, or authentication behavior |
| `content` | Reviewed Wiki articles and glossary source data | Published guidance, FAQs, article metadata, or glossary wording |
| `scripts` | Repeatable build-time data preparation | Search indexes, retrieval indexes, or taxonomy extraction |
| `tests` | Regression coverage for product rules | A change that must remain safe over time |
| `docs` | Current contributor guidance and review-only historical material | Understanding the project before editing it |

## Key flows

### Ask a Question

`app/generate` gathers the question and delivery choice. `/api/artifact` retrieves evidence, grounds it, creates a normalized artifact, and records internal metadata. The same result then feeds the visible answer, PDF renderer, and email renderer.

### Published content

`content/pillars` holds reviewed MDX. `lib/content` validates it against the canonical taxonomy, then `/wiki`, `/browse`, and `/a/...` render it. Build scripts create the retrieval and search indexes from this approved content.

### Brain

Brain code keeps each visitor's uploaded material separate from the shared reviewed library. Extraction reads a file, jobs prepare it, weaving persists it, retrieval combines it only with that visitor's answer context, and graph code prepares the visual model.

## Files that must stay where they are

Keep `package.json`, `package-lock.json`, Next.js and TypeScript configuration, `content` JSON, route files, and generated index locations unchanged. npm, Next.js, deployment tooling, and imports expect those paths.
