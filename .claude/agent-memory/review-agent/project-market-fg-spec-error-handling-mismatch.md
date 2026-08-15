---
name: market-fg-spec-error-handling-mismatch
description: feat/market-fear-greed round 2 — design spec §5 error table describes per-series graceful degradation that the shipped fetch code does not implement (Promise.all is all-or-nothing)
metadata:
  type: project
---

`docs/superpowers/specs/2026-08-15-market-wide-fear-greed-design.md` §5's error table row
"FMP 6종 중 일부 실패 → 해당 시리즈 빈 배열 → inner join 결과 0 → 스냅샷 `null`" implies a single
failing FMP call degrades only that one series to `[]`, leaving the other five intact, and the
inner join alone produces the null-snapshot outcome.

That is not what the code does. `src/shared/api/fmp/httpClient.ts`'s `fmpGet` retries transient
errors (429/5xx/timeouts) then throws `FmpHttpError` on any non-2xx — it does not return `[]`.
`fetchDailyCloses.ts`'s own `if (!Array.isArray(rows)) return []` only fires for a 200 response
with a malformed body, not for an actual failed call. `marketFearGreedCache.ts`'s
`buildMarketFearGreedView` maps all 6 series through a bare `Promise.all` with no per-item catch,
so one symbol's real FMP failure rejects the whole `Promise.all` and aborts all 6 fetches — the
other 5 successful series are discarded too. The visible end state (200 page, "insufficient data"
copy) ends up matching row 2's outcome, but only via row 4's "로더 예외 → catch" mechanism in
`app/fear-greed/page.tsx`, not row 1's claimed per-series inner-join mechanism. `getOrSetCache`
(`shared/cache/getOrSetCache.ts`) has no try/catch around `await fetcher()` either, so the reject
propagates all the way up uncaught until `page.tsx`'s `.catch()`.

This is the same class of bug MISTAKES.md #15.6 names (comment/doc claims not matching runtime
reality) and the same severity as the round-1 §4.1 TTL doc/code contradiction on this branch —
flagged as `required` in round 2.

**Why:** the spec's framing suggests resilience (partial-basket tolerance) that doesn't exist;
a maintainer reading only the spec would wrongly assume a single transient ETF hiccup only shrinks
one factor's input instead of blanking the entire market reading for that cache window (up to ~2h:
Redis 1h + ISR 1h).

**How to apply:** when reviewing `market-fear-greed` (or any multi-source `Promise.all` fetch/cache
layer) in later rounds, check whether the design doc's error table matches actual throw-vs-degrade
semantics by reading the fetch adapter (`fmpGet`/equivalent) directly — don't take a table row at
face value even if the surrounding TTL/reuse claims in the same doc were already verified correct.

**Round 4 resolution (2026-08-15):** Fixed as a confirmed 5-agent deployment-audit finding, but
reframed rather than made per-series-resilient: `fetchDailyCloses.ts` now throws when FMP returns
`200 []` (unknown/delisted symbol) or zero usable rows after the price/date guard, instead of
silently returning `[]`. `marketFearGreedCache.ts`'s doc comment now states the accurate semantics
directly ("A failed FMP call throws out of `Promise.all` rather than degrading to an empty
series... `getOrSetCache` never writes when the fetcher throws") — the spec-doc/code mismatch this
memory flagged is gone because the code comment itself now carries the correct claim. Verified:
`fetchDailyCloses.test.ts` covers the throw (zero-rows, non-array response, all-guarded-out rows)
and the pass-through-of-fmpGet-rejection cases; `marketFearGreedCache.test.ts` has an explicit
"fetchDailyCloses가 reject하면 흡수하지 않고 그대로 전파한다" test. `page.tsx`'s outer `.catch()`
remains the single catch boundary (200 + degraded render), confirmed by test and by reading
`getOrSetCache` (no try/catch around `await fetcher()`).
