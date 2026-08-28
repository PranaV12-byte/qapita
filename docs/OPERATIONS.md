# Release and operations guide

## Before a release

1. Rebuild indexes after content or taxonomy changes.
2. Run tests, type checking, lint, the production build, and `git diff --check`.
3. Review `git status --short` and make sure only intended files changed.
4. Use a preview deployment before promoting a user-facing change.

## Preview checks

At minimum, check:

- Home, Ask a Question, Knowledge Tree, Wiki, glossary, and a published article route.
- A normal answer, an unsupported question, and a comparison when that feature changes.
- PDF download and authenticated email delivery when delivery-related work changes.
- Desktop and mobile layouts.
- `/api/health` for safe configuration-status reporting.

## Configuration and secrets

Deployment configuration, Auth0, email delivery, and model-provider settings are managed outside the repository. Preserve existing values when deploying. Never place a secret in a document, test fixture, browser log, or commit.

## When something fails

Use the smallest relevant log or test output to diagnose the problem. Do not expose a user's question, uploaded material, recipient address, or secret value in shared logs. A generation failure should produce a clear current error or graceful fallback, never a stale answer.

## What this guide does not change

This document does not authorize changes to deployment settings, environment variables, authentication, email configuration, or provider accounts. Those changes require a separate review and explicit approval.
