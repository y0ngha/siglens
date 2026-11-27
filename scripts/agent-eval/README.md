# Agent regression eval (local only)

Drives the real SiglensAI stack over HTTP with a real LLM provider and judges the stored answers and tool rows.
It spends provider tokens and web-search quota, so it **never runs in CI** and is not part of `yarn test`.
The judging functions are pure and unit-tested in `scripts/__tests__/agent-eval-checks.test.ts` (those do run in CI).

## Bring up the local stack

```bash
yarn e2e:up && yarn e2e:db        # local Postgres + Redis, seeded e2e user, all migrations applied
scripts/agent-eval/dev-server.sh  # dev server on :4200 against that stack; leave it running
```

`dev-server.sh`:

- Takes the database and Redis from `.env.e2e`. A `DATABASE_URL` or `UPSTASH_REDIS_REST_URL` set in the calling shell wins
  over `.env.e2e` (a stack on other ports). Before starting, `localGuard.mjs` checks the value the server will actually use
  for each of those two (the shell value if set, else the `.env.e2e` one) and exits 2 unless its host is `localhost`,
  `127.0.0.1` or `::1`. Those are the only database and Redis address variables the app reads. It prints `name -> host:port`
  only, never credentials or tokens. `run.mjs` does not talk to Redis; it applies the same local-host rule to
  `DATABASE_URL`, `--site` and `--ai`.
- Masks every key that exists only in `.env.local`, then re-reads a small allowlist of provider keys without echoing them.
- Turns **fixtures off** (`E2E_TEST` is forced empty, `AGENT_REAL_PROVIDER=1`). With fixtures on, every symbol returns the
  same bars and the results mean nothing.
- Records whether `web_search` is offered (key presence only, never a value) in `scripts/agent-eval/.server-state.json`
  (`AGENT_EVAL_STATE_FILE` overrides the path). `run.mjs` reads it.

## Run

```bash
node scripts/agent-eval/run.mjs --label new --cache --out <scratch>/new.json
node scripts/agent-eval/run.mjs --only osc-1,div-2 --out <scratch>/part.json   # targeted re-check
node scripts/agent-eval/run.mjs --compare <scratch>/old.json <scratch>/new.json
```

Flags: `--label`, `--only a,b` (unknown ids are refused before anything runs; `conv` needs `--cache`), `--cache`
(adds the 4-turn `conv` case and its cached-prefix check), `--out <file>` (required, keep it outside the repo),
`--compare a b`, `--reference <run.json>` (judge answers that stored no `get_price_stats` result against another run's stored result of the same case; run both the same day so closes are unchanged), `--site <url>` (default `http://localhost:4200`), `--ai <url>` (default `http://ai.localhost:4200`),
`--no-web-search` (force "web_search not offered"), `--turn-at-fallback` (when measuring an older app that stores no
`turn_at`, rebuild the clock note from `created_at`).

Environment: `DATABASE_URL` (otherwise the one line is read from `.env.e2e`), `AGENT_EVAL_STATE_FILE`,
`AGENT_EVAL_NOTE_CORE` (path of the core build used to rebuild the reference clock note, for an older app).
`run.mjs` exits 2 unless the site URLs and the database are local, the seeded e2e user and the `turn_at` column exist,
and the dev server's conversation shows up in that database.

## Output

Per case: `fails` (hard), `reviews` (for a human or judge), and `notEvaluable` (a check that could not be decided, such as
the `holder` case when `web_search` is not offered, or earnings day counts when the tool result lacks the field). A
`notEvaluable` line is never a pass. The JSON records `server.webSearch` (`true`, `false`, or `null` when unknown).

## Budget

About 45 provider calls per variant for the original set (14 single-turn cases plus the 4-turn `conv`; the WP-08 cases add about 24 single-turn calls more), roughly twice that for an old/new
comparison, plus up to two web searches per variant from the shared daily search budget. Send nothing else through the
same key while measuring cache behaviour, and compare cached tokens from turn 2 on only. Use `--only` to re-check one
case instead of the whole set.

## WP-08 checks (tool results that carry interpretive facts)

Deterministic, read from the stored tool rows, hard `fail` unless noted. A check that cannot find its input reports
`notEvaluable`, never a pass. `earningsTally`, `putCallSide` and `levelsNearest` evaluate OLD runs too: when a result lacks the new field they
compute the reference from the raw recorded fields with core (`tallyEarningsReactions`, `readPutCallRatio`, `buildLevelLadder` over the recorded
analysis levels, without chart references, which a review line says).

| Check | Cases | Reads | Fails when |
|---|---|---|---|
| `earningsTally` | earn-* | `get_fundamentals.earningsReactionTally` | a "N번 중 M번 상승/하락" or "M번 올랐/내렸" count differs from `up`/`down` (or N from `measured`); a "가장 크게 오른/최대 하락 X%" differs from `largestRise`/`largestFall` |
| `putCallSide` | pc-* | `get_options_summary.metrics.putCallReading`, `get_investor_flows` 13F `reading` | a sentence quoting that source's ratio says the opposite side (풋이 더 많, 하락 베팅이 많, 풋 우위, or the converse) |
| `levelsNearest` | levels-* | `get_cached_analysis.sinceAnalysis.levelLadder` | a number after "가장 가까운 지지/저항" is not `below[0]`/`above[0]` (±0.01); two numbers in one role; "저항/지지가 더 가깝다" contradicts `closer` (ties are a review line) |
| `newsAligned` | news-*, kr-month (`periodStart`) | `get_news` results and calls | a stored result is cut (`truncated:true` or not JSON); `since` missing or more than 3 days from the period start; a headline tied to a date earlier than its `session`; a `session: null` item presented as a cause. Review line: answer dates beside `priceMoves.moveDays` |
| `holderLookupUsed` | holder, holder-2 | first `get_investor_flows` call, `holderLookup` | the first call has no `holder`; status `found` but the answer lacks the grouped share count or the period. Other statuses: share check not evaluable |

## WP-09 checks (price statistics, `get_price_stats`)

Case fields added: `mustCallAny` (fail when none of the listed tools was called), `reviewIfCalled` (a review line, never a
failure, for boundary cases) and `expectArgs` (one `get_price_stats` call must satisfy every listed argument; keys are
documented at `argMismatches` in `checks.mjs`). Judged from stored rows; a check without its input reports `notEvaluable`.

| Check | Cases | Fails when |
|---|---|---|
| `priceStatsSelection` | ps-* with `expectArgs` | no single `get_price_stats` call matches `expectArgs` (three single-symbol calls for a three-symbol comparison fail). The tool-name conditions (`mustCall`, `mustCallAny`, `mustNotCall`) are reported by `runChecks`. This is the primary metric |
| `priceFigures` | ps-* | a percent in a sentence about returns, drops or annual rates is none of `returnPct`, `cagrPct`, `fromHighestClosePct`, `maxDrawdown.pct` (0.01, sign-insensitive); a close quoted next to a date differs from `closes[].close`. An answer with no stored result of its own is judged against `--reference` |
| `priceStatsDates` | ps-date-* | a `previous_session` date is answered without naming the session date; an `after_last_close` date is given a close (unless the sentence says there is none) |
| `noAnnualRateUnderYear` | ps-* | every window subject has `cagrPct: null` yet the answer gives an annual rate |
| `correlationNoCause` | ps-corr-* | review line only: a correlation sentence also reads as a cause |

## WP-09 notes checks (null rules moved from descriptions to result `notes`)

Run both arms (OLD: the rule is in the description, NEW: the result carries `notes`) on the same questions; `div-1..3`
(`dividendVerbatim`) run with them. A check whose stored result is not shaped to test its rule (the field is not null) reports
`notEvaluable`, never a pass.

| Check | Cases | Fails when |
|---|---|---|
| `streakNotFromOtherTimeframe` | n-streak-1 | no `get_bars_indicators` call with `timeframe: 1Day` yet the answer counts a streak ("3일 연속"); or, after a 1Day call, the count differs from `derived.closeStreak.days` (`truncated`: fewer than `days`). A "cannot determine" answer passes |
| `crossNotDeniedOnShortHistory` | n-cross-1 | the stored 1Day `derived.maCross50_200` is `null` (scan incomplete) and a sentence says no cross happened. A stored `[]` or list is not evaluable: pick a younger listing (under ~450 sessions) |
| `nonPayerSaysNone` | n-div-1 | the stored `dividends` is the confirmed non-payer shape and `web_search` was called or the answer does not say no dividend is paid. Other shapes: not evaluable |
| `earningsTimingNotInvented` | n-earn-1 | no `analyst.earningsSession` and no `web_search`, yet an unhedged sentence states a before/after-market timing. No stored `nextEarningsDate`: not evaluable |

Boundary cases: `b-idxh-1` and `b-swing-1` must not call `get_price_stats`; `quote` must not; `trend-*` and `b-52w-1` leave a
review line if it is called.

The run summary and `--compare` count the not-evaluable lines (`old n/e`, `new n/e` columns) beside the failures.

`run.mjs` also stores per-turn side-effect numbers (`sideEffects`: answer chars, figure sentences, steps, tool calls,
web searches, core `findUngroundedNumbers` count) and `--compare` prints them for old and new, next to the dropped/added
tools (a dropped tool is a regression even when the answer reads well).

Local live run for the WP-08 cases (same stack as above, old build first, then new, on a weekend, one warm-up question each):

```bash
ONLY=news-month-1,news-month-2,news-month-3,news-month-4,news-why-1,pc-1,pc-2,levels-1,levels-2,earn-1,earn-2,kr-month,trend-1,trend-2,holder
node scripts/agent-eval/run.mjs --label old --only $ONLY --out <scratch>/old.json
node scripts/agent-eval/run.mjs --label new --only $ONLY --out <scratch>/new.json
node scripts/agent-eval/run.mjs --compare <scratch>/old.json <scratch>/new.json
```

15 cases x about 2.5 provider steps = about 38 calls per variant, about 76 for both (plus the warm-up turn each).
The news cases need an ingested news window; the `holder` case checks only that `holder` is passed (no 13F rows locally).

## Saved-conversation replay (E1)

`replayTools.mjs` turns recorded tool results into the NEW shape by calling the app's own exported functions
(`withEarningsReactionTally`, `withPutCallReading`, `withLevelLadder`, `lookupHolder`, and core's `readPutCallRatio`):
no copy of production logic, no network, no database. `replay.mjs` is the dry run: it pushes every recorded call through
the OLD and NEW executors and writes what changed. The LLM loop itself is a scratch harness (outside the repo) that
imports `makeReplayExecutor` and uses `execute(name, args)` as the agent's tool executor.

```bash
node --conditions=react-server --import tsx scripts/agent-eval/replay.mjs <input.json> --out <scratch>/replay.json
```

Input (`<input.json>`, never committed):

```jsonc
{
  "version": 1,
  "holderData": {                     // optional; only for cases whose recorded call has a `holder` argument
    "<SYMBOL>": {
      "cusip": "string", "cusipCreatedAt": "ISO instant (cusip_symbol_map.created_at)",
      "aggregates": [{ "period": "YYYY-MM-DD", "holders": 0, "shares": 0, "valueUsd": 0, "newHolders": null,
                       "increased": null, "decreased": null, "exited": null, "netShareChange": null }],
      "latestPositionPeriod": "YYYY-MM-DD | omitted",
      "filers": [{ "cik": 1, "name": "string" }],
      "positions": [{ "cik": 1, "period": "YYYY-MM-DD", "shares": 0, "valueK": 0 }],   // value in thousands, as stored
      "filings": [{ "cik": 1, "period": "YYYY-MM-DD", "processed": true, "universeStamp": "ISO instant | null" }]
    }
  },
  "cases": [{
    "id": "string", "question": "string", "today": "YYYY-MM-DD",        // `today` picks the 13F quarter
    "recorded": [{ "name": "tool name", "args": {}, "result": {} }]      // tool rows of the turn, call order; result may be a JSON string
  }]
}
```

Matching: name + all args, then name + symbol + timeframe (+ tab); anything else is a `replay_miss` (counted in `misses`).
A recorded result that is not JSON (cut) is returned as is. The ladder's chart references come from the recorded
`get_bars_indicators` result of the same case (`derived.range`, `derived.ranges['20bars']`, `latest.ma`), so record that
call too.
