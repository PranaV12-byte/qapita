# EquityIQ

EquityIQ is a private knowledge and drafting application for employee equity topics. It combines reviewed Wiki content, retrieval-backed answer generation, optional user-uploaded material, PDF export, and authenticated email delivery.

## What people can do

- Ask a question and receive a grounded answer, PDF, email draft, or comparison.
- Browse the Knowledge Tree and read reviewed Wiki articles.
- Search the glossary and published content.
- Upload private material to Brain for use in their own questions.

## Start locally

1. Use Node.js 22 or a compatible version.
2. Install dependencies with `npm install`.
3. Create local configuration from `.env.example`. Keep real values only in `.env.local` or the deployment provider.
4. Start the app with `npm run dev`.

The terminal reports the local address when the app is ready.

## Everyday checks

| Goal | Command |
| --- | --- |
| Run tests | `npm test` |
| Check types | `npx tsc --noEmit` |
| Check style | `npm run lint` |
| Build for release | `npm run build` |
| Rebuild content indexes | `npm run build:index` and `npm run build:search` |

The production build already rebuilds the content indexes first.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Code map](docs/CODEMAP.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Content guide](docs/CONTENT.md)
- [Release and operations guide](docs/OPERATIONS.md)

`CLAUDE.md` remains the repository's existing agent guidance. Historical specifications and old setup notes are available only for review in [docs/archive](docs/archive/README.md); they are not the current source of truth.
