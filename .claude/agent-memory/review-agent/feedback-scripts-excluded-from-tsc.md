---
name: feedback-scripts-excluded-from-tsc
description: A green `tsc --noEmit` proves nothing about scripts/ or worker/ — tsconfig excludes them, so core breaking-signature bumps silently leave those callers broken
metadata:
  type: feedback
---

`tsconfig.json` in siglens has `"exclude": ["node_modules", "worker", "scripts"]`. So when a
round-summary says "`npx tsc --noEmit` exit 0" after a `@y0ngha/siglens-core` version bump with
breaking signature changes, that green is **scoped to `src/` only**. Always grep the changed core
symbols across `scripts/`, `worker/`, and `e2e/` by hand.

**Why:** on `feat/asset-class-navigation` (core 0.48.0, `EconomicEventAnalysisInput.region` became
required), both `scripts/seedEconomicEventAnalysis.ts` and `scripts/seedCalendarAnalysisBatch.ts`
still built the input without `region` and were invisible to tsc. Both persist under an
`analyzed_at IS NULL` write-once guard with no re-analysis path, so a run would have frozen
`Region: undefined` commentary permanently — the exact failure the commit existed to prevent. The
batch script's query has no `country` filter either, so it would have swallowed the freshly
ingested KR rows. It had *also* been silently broken since two earlier changes
(`listUnanalyzedAnnounced` gained a `country` param; `buildEconomicEventAnalysisPrompt` started
returning `{stable, dynamic}` instead of a string) — nothing had ever caught it.

**How to apply:**
- Any diff that bumps `package.json`'s `@y0ngha/siglens-core` pin: run
  `grep -rn "<changed symbols>" src scripts worker e2e` and check every hit outside `src/`.
- Weight the finding by irreversibility, not by "it's only a script": a one-off backfill script
  that writes under a write-once DB guard is a higher-severity target than a live route that can
  simply be redeployed.
- The lazy fix is often deletion — these are documented `ONE-OFF` / `One-time SEED` scripts whose
  DB shape has already drifted; ask whether they should exist rather than patching them forward.

Mirrors MISTAKES §Documentation-Sync-6 (local mirror falls behind a core union expansion — not
TypeScript-detectable). Pairs with [[feedback-audit-enumerate-slice-not-difflist]].
