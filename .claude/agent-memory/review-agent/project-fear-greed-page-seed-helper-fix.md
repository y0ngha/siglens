---
name: project-fear-greed-page-seed-helper-fix
description: perf/rsc-flight-fear-greed R1 approved — swapped [symbol]/fear-greed/page.tsx RQ seed from getQuantizedBarsStatic to getSeedBarsStatic, killing a duplicated 441KB indicators block in the RSC flight
metadata:
  type: project
---

`src/app/[symbol]/fear-greed/page.tsx` was the sole holdout still seeding React
Query with `getQuantizedBarsStatic` (full 44-indicator `IndicatorResult`) while
`[symbol]/layout.tsx` and `[symbol]/page.tsx` already used `getSeedBarsStatic`
(whitelist: rsi/macd/buySellVolume only, rest blanked via
`EMPTY_INDICATOR_RESULT`). Because `React.cache` folds duplicate Flight
entries only on reference equality, the mismatched helper meant `/AAPL/fear-greed`
serialized the indicators block **twice** (53KB reduced + 441KB full) even
though only one page reads indicators server-side.

**Why the fix is safe (verified by reading `barsStaticCache.ts`, not just
trusting the PR description):** `getSeedBarsStatic` is `cache(async (...) =>
{ const data = await getQuantizedBarsStatic(...); return { bars: data.bars,
indicators: { ...EMPTY_INDICATOR_RESULT, rsi: data.indicators.rsi, macd:
data.indicators.macd, buySellVolume: data.indicators.buySellVolume } }; })`.
It internally calls the full helper and passes `bars`/`buySellVolume` through
by **reference**, so the sole consumer (`FearGreedFactsSummary`, props
`bars: Bar[]` + `buySellVolume: BuySellVolumeResult[]`,
`computeFearGreedIndex(bars, buySellVolume)`) gets byte-identical SSR output
before/after. Confirmed no other node in the fear-greed subtree (server or
client, `useFearGreedFromSymbol` → `useBars`) reads a blanked field —
grep for `indicators.` in `src/widgets/fear-greed` + `src/views/symbol/fearGreed`
turns up only `indicators.buySellVolume`.

**Verification method that caught nothing wrong (all claims held):** diffed
the working tree against `git show origin/master:<path>` per-file (not `git
diff` on stale hunks) — confirmed the page.tsx diff touches only the
import/call-site/comment/log-message, nothing in the null-path or
empty-bars-path. Then independently reverted the call site with `sed`, ran
`yarn test "src/app/[symbol]/fear-greed"` → 8/14 failed (matches claimed
red), restored, reran → 14/14 green. `yarn tsc --noEmit` and `oxlint` on the
3 touched files both clean with `EXIT:0` captured explicitly (not piped
through `tail` blind).

**Stale-comment root cause, checked for recurrence:** the bug's origin was a
comment on this page claiming "same *arguments* as layout.tsx" is sufficient
for `React.cache` folding — true only if the *helper* also matches. The fix
rewrites the comment to say "같은 헬퍼·같은 인자" explicitly. Checked
`layout.tsx` (unmodified, out of diff scope) for the same stale premise —
its two adjacent comment blocks (one citing `getQuantizedBarsStatic` JSDoc
for the args-matching point, one for why `getSeedBarsStatic` specifically is
used) are jointly accurate, not a recurrence. `[symbol]/page.tsx` and
`position/page.tsx` still legitimately call `getQuantizedBarsStatic` directly
(they read indicators server-side beyond the whitelist) — not a bug.

See also [FF Principles](rules-ff.md), [Conventions](rules-conventions.md).
