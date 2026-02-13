<!-- Parent: ../AGENTS.md -->

# tests/ — Test Suite

## Purpose

End-to-end and integration tests for BoltDown.

## Subdirectories

- `e2e/` — Playwright E2E tests

## Key Files

- `e2e/example.spec.ts` — Placeholder Playwright test (skipped, TODO: implement Tauri app testing)

## For AI Agents

- Testing infrastructure is set up (Vitest + Playwright in package.json) but tests are minimal
- Vitest config is in `src/test/setup.ts`
- Run frontend tests: `npm run test` (when implemented)
- Run Rust tests: `cd src-tauri && cargo test`
- E2E tests require Tauri-specific Playwright setup (not yet configured)
