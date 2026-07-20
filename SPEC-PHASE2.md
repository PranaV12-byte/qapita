# Phase 2 — Full Knowledge Portal

> DO NOT implement until Phase 1 chatbot is working end-to-end.
> Each section below is independent — implement in any order.

---

## A. 29 stub articles (rerun build:index after)

Write remaining MDX files (300-500 words each, real facts, same Zod frontmatter, 3 FAQs):

**awards/** — psus.mdx (1.5), sars-phantom.mdx (1.6), dividends.mdx (1.7)
**lifecycle/** — grant-acceptance.mdx (2.1), settlement-release.mdx (2.4), liquidity-exits.mdx (2.5)
**tax/** — payroll-withholding.mdx (3.4), multistate-mobility.mdx (3.5), cost-basis-reporting.mdx (3.6), section-409a.mdx (3.7), 280g-golden-parachute.mdx (3.8)
**accounting/** — grant-date-fv.mdx (4.1), expense-forfeitures.mdx (4.2), modifications.mdx (4.3), eps-dilution.mdx (4.4)
**securities-law/** — sec-rule701-s8.mdx (5.1), section-16.mdx (5.2), proxy-exec-comp.mdx (5.4), 10k-10q.mdx (5.5), year-end-filings.mdx (5.6), rule-144.mdx (5.7)
**plan-design/** — share-reserve-limits.mdx (6.2), award-design-trends.mdx (6.3), benchmarking.mdx (6.4), 409a-valuations.mdx (6.5)
**admin-ops/** — day-to-day-admin.mdx (7.1), participant-comms.mdx (7.2), advisor-broker.mdx (7.4), compliance-calendar.mdx (7.5)

After writing: `npm run build:index` to rebuild the vector index with all 41 articles.

---

## B. Browse & article pages

- `/browse` — 7 pillar cards linking to `/p/[pillar]`
- `/p/[pillar]` — node list for that pillar
- `/a/[pillar]/[slug]` — full article:
  - Breadcrumb, StatusBadge, PlainLanguageCallout, body via next-mdx-remote/rsc
  - `<Advanced>` MDX component (collapses in Plain lens)
  - Sources row, FaqAccordion, RelatedNodes
  - CTA "Generate an artifact" → `/generate?nodeId=<id>`

---

## C. Lens system (Pro/Plain toggle)

- `LensProvider` — React context + localStorage, default Pro
- `data-lens` attribute on `<body>`
- `<Advanced>` MDX component: collapses in Plain, expander "Show professional detail"
- Empty summaryPlain fallback: "A plain-language version of this article isn't available yet — showing the professional version."

---

## D. Glossary

- 40 glossary terms in `content/glossary/`
- `/glossary` — A-Z index
- `/glossary/[term]` — definition + "Appears in" node links

---

## E. Start Here

- 6 Start-Here cards in `content/start-here/`
- `/start-here` — forced Plain lens, "Shown in plain language."
- Home banner (dismissible): "New to equity compensation? Start with the basics."

---

## F. Search

- `SearchOverlay` — full-screen mobile / modal + Cmd-K desktop
- Client-side MiniSearch from `public/search-index.json`
- `/search?q=` — shareable results page
- No search API route
- Build script emits `public/search-index.json`

---

## G. Desktop layout (lg 1024px+)

- Fixed 280px left rail, sticky, accordion pillars
- Current node: accent text + hairline left rule
- Article column: 680px measure centered
- Top nav replaces bottom tabs

---

## H. Ingest pipeline (when scrape data arrives)

- `data/scrapes/fixtures/sample.jsonl` — 10 hand-written fixture records
- `npm run ingest`: load JSONL → coverage map → generation packets
- Adapters for real scrape data (write when files arrive)

---

## I. Tests

- Vitest: content loader, retrieval rerank, scenario matcher, provider contract
- Playwright smoke: home → browse → article → lens → generate → chip → result → copy

---

## J. Production hardening (before Oct 12)

Auth, rate limiting, prompt-injection guards, real email (SendGrid), Postgres,
WCAG 2.1 AA, Sentry, analytics, flip noindex, privacy policy, CCPA.
