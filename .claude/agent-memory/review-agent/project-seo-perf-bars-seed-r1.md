---
name: project-seo-perf-bars-seed-r1
description: worktree-seo-perf-bars-seed R1 — layout.tsx drops 76KB bars seed for a server-computed fearGreedSnapshot prop; architecture claims verified, coverage gap found via mutation
metadata:
  type: project
---

`src/app/[symbol]/layout.tsx`'s `SymbolLayoutChrome` stopped seeding
bars/buySellVolume into React Query (was on all 9 tabs, 76KB raw, 47% of
`/position`'s flight payload) and instead computes a `FearGreedSnapshot` via
core's `computeFearGreedIndex(quantized.bars, quantized.indicators.buySellVolume)`
and passes it as a prop through `SymbolLayoutHeader` → `FearGreedHeaderChip`.
`FearGreedHeaderChipMounted` (the client wrapper with `useHydrated` skeleton +
`useFearGreedFromSymbol`) was deleted along with its test.

**Architecture claims verified true (no findings):**
- `getSeedBarsStatic(ticker, DEFAULT_TIMEFRAME, marketProfileOf(assetInfo), assetInfo.fmpSymbol)`
  call args in layout.tsx match byte-for-byte (arg order, uppercase ticker) both
  `src/app/[symbol]/page.tsx` (chart) and `src/app/[symbol]/fear-greed/page.tsx` —
  `React.cache` folding is intact, no double-seeding regression. See
  [[project-fear-greed-page-seed-helper-fix]] for why this specific match matters
  (Flight serializer folds only on reference equality).
- Nesting reasoning holds: layout's `HydrationBoundary` wraps only the header;
  chart/fear-greed pages have their own independent `HydrationBoundary` around
  their own `QueryClient` seeding bars for `SymbolPageClient`/`FearGreedPage`.
  `HydrationBoundary` hydrates into the shared client on mount (not a
  parent-child composition of dehydrated state), so removing the layout's bars
  seed doesn't affect either page's own seed.
- `useFearGreed.ts` (`computeFearGreedIndex(bars, buySellVolume)` +
  `computeFearGreedHistory`) is the exact function+arg-order the deleted client
  hook used — the server computation is a faithful port, not an approximation.
- Deleting `FearGreedHeaderChipMounted` lost nothing but the hydration
  skeleton — no analytics/ref side effects existed in it, no shared-fetch
  interaction was lost (dual-mount fetch sharing is moot now, there's no
  fetch at all).

**Required finding, mutation-verified live:** `SymbolLayoutChrome`'s new
`fearGreedSnapshot` computation/threading has **zero** test coverage. Hardcoding
`const fearGreedSnapshot = null;` (deleting the `computeFearGreedIndex` call
entirely) in `layout.tsx` and running `layout.test.tsx` +
`SymbolLayoutHeader.test.tsx` together → 36/36 still pass. Root cause: (1)
`layout.test.tsx` mocks `SymbolLayoutHeader: () => null` so the JSX
`SymbolLayoutChrome` returns is never inspected for its `fearGreedSnapshot`
prop; (2) `SymbolLayoutHeader.test.tsx` always renders with
`fearGreedSnapshot={null}` and mocks `FearGreedHeaderChip: () => mockFearGreedChip()`
(drops all received props), so no test ever exercises a non-null snapshot
being forwarded. A swapped-arg mutation
(`computeFearGreedIndex(buySellVolume, bars)`) or a hardcoded-null chrome
would ship silently — the score shown to users and JS-less crawlers on all 9
tabs would be wrong/missing with 0 red tests.

**Required finding:** `SymbolLayoutHeader.tsx` lines 103-106 (JSX comment
above the desktop `<FearGreedHeaderChip>`) still claims "useBars가
useSuspenseQuery 기반이라 promise를 throw하면 부모 트리까지 suspend된다" —
false now. `FearGreedHeaderChip` (unchanged file) takes `snapshot` as a plain
prop, has zero hooks, never suspends/throws. A second paragraph was correctly
appended acknowledging the change, but the stale first paragraph was left in
place, actively contradicting it in the same comment block (MISTAKES 15.6
pattern — recurring, heavily tracked).

**Also stale:** `layout.test.tsx` lines 1-14, the file's top JSDoc still
describes "SymbolLayoutChrome SSR seed tests — verifies bars seed
quantization + stable updatedAt" with Happy/Worst-case bullets about
`setQueryData`-ing bars with quantized `updatedAt` — the rewritten suite
below it tests the **opposite** (seed absence). Not updated when the suite
was swapped.

**Freshness question (focus area #1), judged non-blocking (recommended
only):** the header badge is now capped at ISR bars freshness (≤6h,
forming-bar-stripped via `getSeedBarsStatic`'s internal quantize) instead of
live client refetch. This is a real behavior change beyond mere cache
staleness — previously the client refetch included the forming/current-session
bar (via live `getBarsAction`), so an open-market session's badge reflected
intraday volume flow; now it always reflects the last *closed* session
regardless of client refresh. Judged acceptable because (a) the dedicated
`/[symbol]/fear-greed` detail page is untouched and still live-refetches via
`useFearGreedFromSymbol`/`useBars`, so the authoritative view isn't stale; (b)
every other number on ISR-cached tabs is equally capped; (c) the tradeoff and
its mechanism are already documented in the JSDoc with production numbers.

See also [[rules-ff]], [[rules-conventions]], [[feedback-file-can-change-mid-review]].
