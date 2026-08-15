---
name: market-fg-round4-audit-fixes
description: feat/market-fear-greed round 4 — 9 confirmed 5-agent-deployment-audit findings, all verified correct with no required/recommended findings
metadata:
  type: project
---

Round 4 of `feat/market-fear-greed` (repo `siglens-market-fg`) fixed 9 findings from a five-agent
deployment audit. All verified correct on review (approved, no findings):

1. `/fear-greed` was 301'd to `/FEAR-GREED` at runtime because `isAdmissibleSymbolShape` accepts
   hyphenated tickers and `proxy.ts` runs before routing. Fixed by adding `'fear-greed'` to
   `RESERVED_FIRST_SEGMENTS`. The added guard test dynamically `readdirSync`s `src/app` for
   directories with a `page.tsx`/`route.ts` and asserts none 301s to its uppercase form — this is a
   real regression gate (confirmed the `it('src/app 하위 라우트...')` sanity check exists so the
   `it.each` can't silently become empty, matching MISTAKES.md's guard-test-integrity concern).

2. FMP's EOD endpoint returns a row for the *in-progress* session (live price, not a close). Fixed
   via a `to` bound: `lastPublishedSessionDate` → `lastClosedSessionDateEt` (shared helper the bars
   cache already uses). Computed once in `buildMarketFearGreedView` and threaded through
   `fetchDailyCloses(symbol, from, to)` for all 6 series — verified via a test asserting all 6 calls
   receive the identical `to`. Import direction legal under FSD (entity `lib/` importing
   `shared/api/...` deep path is allowed since `lib/`/`actions/` files are exempt from the
   barrel-only import rule).

3. Zero-usable-closes now throws instead of silently returning `[]` (was surfacing FMP
   unknown-symbol/outage as a fake "표본 부족" warm-up state with nothing logged). Resolves
   [[project-market-fg-spec-error-handling-mismatch]] — see that memory for the full resolution
   note. Confirmed the throw cannot fire during legitimate warm-up (needs literally 0 usable rows,
   not "fewer than confidence threshold"), and `getOrSetCache` has no try/catch around `fetcher()`
   so the throw reaches `page.tsx`'s `.catch()` → 200 render, confirmed by both reading the code and
   a passing test suite (186/186 in the fear-greed scope, `tsc --noEmit` and `yarn lint` both exit 0
   independently re-run, not just trusted from the round summary).

4. New CloudWatch metric filter/alarm (`infra/aws/07-alarms.sh` + `DEPLOY_RUNBOOK.md`). Filter
   pattern `'"[FearGreedRoute] getMarketFearGreedStatic failed"'` (no trailing colon) is a
   deliberate common-prefix match for both `page.tsx` call sites (`...failed:` and
   `...failed (metadata):`) — matches the codebase's existing bracket-in-quotes filter pattern
   convention (same style as the pre-existing `analysis-stream` and `isr-cache` filters in the same
   file). Threshold (period=3600, evaluation-periods=2, threshold=2) matches the runbook's stated
   "1시간 합계 > 2, 연속 2주기" exactly.

5. `generateMetadata` now async, calls `getMarketFearGreedStatic()` wrapped in `.catch(() => null)`
   — cannot throw out of `generateMetadata`. The "fetch happens once even though both
   `generateMetadata` and the page body call the same loader" claim in the code comment is
   technically accurate: `getCachedMarketFearGreed` is wrapped in React's `cache()` (per-request
   dedup, the documented Next.js pattern for sharing data between `generateMetadata` and the page
   component), with `unstable_cache` layered on top for cross-request/ISR caching — this is not a
   MISTAKES-15.6-style false comment.

6. `[symbol]/fear-greed/page.tsx` prose links "시장 전체 공포·탐욕 지수" to `/fear-greed` (our own
   page, not CNN) — reads correctly in Korean, sentence structure confirmed grammatical.

7. `MarketFearGreedFactorBar` h4→h3 — confirmed no level skip: page h1 → widget h2 ("요인별
   기여도") → factor h3, siblings under h1 are all h2.

8. E2E fixture (`e2eFearGreedFixture.ts`) gated by the pre-existing `isE2E()` env check
   (`E2E_TEST === '1'`), same pattern already used to gate worker/LLM submission paths elsewhere —
   not a new leak vector. E2E spec assertions are falsifiable (exact heading names/levels matching
   `page.tsx` constants verbatim, `progressbar` count === 5 factors, sitemap entry substring,
   redirect-regression check via `maxRedirects: 0`).

9. Test hardening across entity/widget `__tests__/`: `marketFearGreedSymbols.test.ts` pins the
   HYG/LQD ticker table exactly (catches a transposed high-yield/investment-grade bug that would
   otherwise compile fine under `Record<K,string>`); `MarketFearGreedFactorBar.test.tsx` asserts the
   exact fill class per percentile band AND asserts the other 4 band classes are absent (catches an
   off-by-one shift in `BAR_FILL_COLOR`); `marketFearGreedCache.test.ts` adds a real-core-functions
   integration test with per-series-seeded LCG synthetic closes.

**Why:** this was a clean round — worth recording that a 9-item, cross-cutting (proxy, cache,
infra/alarms, docs, 2 pages, widget, E2E, tests) audit-fix round landed with zero required/
recommended findings, and *how* each item was independently verified (not just re-reading the
round summary) — grep for actual log-line prefixes against the alarm filter pattern, running the
scoped test/tsc/lint gates directly rather than trusting the "9144 tests pass" claim, tracing the
FSD import legality by checking which subfolder the importing file lives in.

**How to apply:** if a future round touches these same 9 areas again, re-verify from the file
content each time — don't assume round 4's clean bill carries forward automatically, but the
patterns here (React `cache()` + `unstable_cache` double-wrap for generateMetadata/page dedup,
`isE2E()` fixture gating, CloudWatch bracket-in-quotes filter patterns, `RESERVED_FIRST_SEGMENTS`
guard-test-integrity) are all established, reusable conventions in this codebase — recognize them
rather than re-litigating from scratch.
