---
name: project-seo-perf-bars-seed-r2-closed
description: worktree-seo-perf-bars-seed R2 — all 3 required + 1 recommended R1 findings verified fixed via live mutation re-test; approved, closes loop
metadata:
  type: project
---

R2 reviewed only the 3 files the implementer touched: `src/app/[symbol]/layout.tsx`,
`src/app/[symbol]/__tests__/layout.test.tsx`, `src/views/symbol/SymbolLayoutHeader.tsx`.
See [[project-seo-perf-bars-seed-r1]] for the original findings.

**Coverage gap (the serious R1 finding) — verified closed by live mutation, twice:**
1. Hardcoded `const fearGreedSnapshot = null;` (R1's exact mutation) → 2/20 tests fail
   (`서버가 계산한 공포·탐욕 스냅샷을 헤더에 넘긴다`, `봉과 buySellVolume을 그 순서로 넘겨 계산한다`).
2. Swapped-arg mutation `computeFearGreedIndex(buySellVolume, bars)` → only the arg-order
   test fails (the forwarding test still passes, since the mock ignores its args and
   returns a fixed fixture) — confirms the two new tests are non-overlapping, each
   catches a distinct fault the other doesn't.
Restored file verified byte-identical to pre-mutation backup both times; full suite
back to 20/20 green after each revert.

**`headerPropsOf(tree)` coupling concern (implementer's own focus area #1), judged not
a real hazard:** the helper reads `tree.props.children.props ?? {}` — if `SymbolLayoutHeader`
were ever wrapped in an extra element, the worry was that it'd silently return `{}` and
assertions would pass vacuously. Empirically disproved during the hardcoded-null mutation
run above: `headerPropsOf` returned the *real* `{ symbol: 'aapl', fearGreedSnapshot: null }`
and `toEqual(expect.objectContaining({ fearGreedSnapshot: {...} }))` failed loudly (missing/
mismatched key fails `objectContaining`, it does not pass on an empty object). No finding
raised — acceptable as a test helper.

**Other 2 required + 1 recommended, confirmed by direct read (no mutation needed):**
- `SymbolLayoutHeader.tsx` JSX comment above the chip rewritten into one coherent block
  (current reality → why the ErrorBoundary is still defensive → historical `useBars`
  rationale in parens). No more self-contradiction. Cross-checked the "no hooks, no
  suspend/throw" claim against `FearGreedHeaderChip.tsx` directly — true, plain
  prop-in/JSX-out component.
- `layout.test.tsx` top JSDoc rewritten to state what the file now fixes (seed absence +
  snapshot forwarding), matches the suite below it.
- Freshness trade-off (forming-bar strip via `getSeedBarsStatic`, not just ISR staleness)
  documented in the layout JSDoc with the three accept-reasons. Judged non-blocking in R1,
  still non-blocking.

`tsc --noEmit` and scoped `oxlint` on the 3 files both exit 0. Approved, no new findings.

See also [[project-seo-perf-bars-seed-r1]], [[feedback-file-can-change-mid-review]].
