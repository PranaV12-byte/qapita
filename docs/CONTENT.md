# Content guide

## Published guidance

Reviewed Wiki articles are stored as MDX files under `content/pillars`. The application currently treats this reviewed set as the published guidance library.

Every article is connected to a canonical taxonomy node. That connection determines its public article route, its position in the Knowledge Tree, and how it appears in related topics.

## Making a content change

1. Update the reviewed MDX article or canonical taxonomy source.
2. Keep the article ID and slug valid and unique.
3. Run `npm run build:index` and `npm run build:search`.
4. Run the relevant content and route tests.
5. Open the article, Wiki index, Knowledge Tree, and search result to confirm the published route is correct.

Do not create a route by concatenating an arbitrary frontmatter string. Canonical routing and validation protect against invalid or corrupted links.

## Knowledge Tree status

The Knowledge Tree can show either published guidance or **Content in preparation**. A preparation item should not pretend to have an article or navigate to an empty search. Do not fabricate an article simply to fill a leaf.

## Generated answers and sources

Generated answers use retrieved evidence, but their prose should remain clean. Internal citation metadata, Related Topics, user-source cards, and Brain backlinks still provide traceability. Reviewed Wiki references remain part of the article content and are different from generated prose.
