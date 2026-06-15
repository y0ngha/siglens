# Yahoo Options Symbol Alias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route options requests through verified Yahoo symbol aliases while preserving SigLens canonical ticker identity.

**Architecture:** A pure helper in `shared/lib` owns provider aliases. Both the Yahoo adapter and the ticker artifact script call it at their provider boundaries; downstream data remains keyed by the original symbol.

**Tech Stack:** TypeScript, yahoo-finance2, Vitest

---

### Task 1: Add the shared Yahoo symbol helper

**Files:**
- Create: `src/shared/lib/yahooSymbol.ts`
- Create: `src/shared/lib/__tests__/yahooSymbol.test.ts`

- [x] Add tests proving `BRK.B` maps to `BRK-B` and exchange suffixes remain unchanged.
- [x] Implement `toYahooSymbol(symbol: string): string` with an explicit alias record.
- [x] Run `yarn test:related src/shared/lib/yahooSymbol.ts`.

### Task 2: Apply aliases in the production options adapter

**Files:**
- Modify: `src/entities/options-chain/lib/YahooOptionsAdapter.ts`
- Modify: `src/entities/options-chain/__tests__/YahooOptionsAdapter.test.ts`

- [x] Add tests for initial fetch, dated fetch, market probe, and canonical snapshot identity.
- [x] Convert the symbol once before Yahoo calls and restore the requested symbol before normalization.
- [x] Run the adapter test file.

### Task 3: Apply aliases in artifact generation

**Files:**
- Modify: `update-popular-tickers.ts`
- Modify: `src/shared/db/__tests__/update-popular-tickers.test.ts`

- [x] Inject a minimal options client into the probe factory for deterministic tests.
- [x] Verify the probe calls Yahoo with `BRK-B`.
- [x] Run the update-script tests and the live update command.

### Task 4: Validate

**Files:**
- Verify all modified files.

- [x] Run related tests.
- [x] Run `yarn typecheck`.
- [x] Run ESLint and Prettier checks for modified code.
- [x] Run the project review workflow and address findings.
