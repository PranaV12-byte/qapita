# Development guide

## Before you change anything

1. Check `git status --short` so you know whether someone already has work in progress.
2. Keep changes small and focused. Do not reset or overwrite unrelated work.
3. Read the relevant tests and nearby code before changing behavior.

## Local setup

Use Node.js 22 or a compatible version. Install dependencies with `npm install`, then create local configuration from `.env.example`. Put real values only in `.env.local`; do not commit them.

Start the application with:

```text
npm run dev
```

## Useful commands

```text
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Run `npm run build:index` and `npm run build:search` after changing reviewed content or taxonomy data. The production build runs both automatically.

## Where to make a change

| Need | Primary location |
| --- | --- |
| Page layout and routes | `app` |
| Reusable interface pieces | `components` |
| Generation, delivery, retrieval, and content rules | `lib` |
| Reviewed articles | `content/pillars` |
| Search and retrieval build steps | `scripts` |
| Automated checks | `tests` |

## Safe verification order

For a normal product change, run the focused tests first. Before handing off a larger change, run tests, type checking, lint, the production build, and `git diff --check`.

For browser-facing changes, also check desktop, tablet, and mobile widths. For answer changes, verify the on-screen answer, PDF, and email attachment use the same clean content.

## Generated files

Do not hand-edit generated indexes or build output. Change the source content or script, then regenerate the output using the provided command. Do not add local runtime logs, `.next`, `node_modules`, or secret configuration to a commit.
