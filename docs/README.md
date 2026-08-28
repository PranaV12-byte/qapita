# EquityIQ documentation

This folder explains the current application in plain language. It is intended to help someone understand the project without reading every source file.

## Start here

- [Architecture](ARCHITECTURE.md) explains how the app is put together and how an answer travels through the system.
- [Code map](CODEMAP.md) shows where application work belongs and how the main flows connect.
- [Development guide](DEVELOPMENT.md) explains local work, checks, and safe changes.
- [Content guide](CONTENT.md) explains published Wiki content, the Knowledge Tree, and search indexes.
- [Release and operations guide](OPERATIONS.md) explains safe release checks and the boundaries around configuration and delivery.

## Source of truth

The code, tests, and current configuration templates are the source of truth for application behavior. `CLAUDE.md` remains the existing repository guidance file and has intentionally not been changed in this cleanup.

Do not put passwords, API keys, or real recipient addresses in this folder. Keep them in local configuration or the deployment provider.

## Historical material

[archive](archive/README.md) contains older specifications and setup notes moved from the project root on 2026-08-28. They are retained for review only. They may describe earlier product decisions and must not override the current code or these guides.
