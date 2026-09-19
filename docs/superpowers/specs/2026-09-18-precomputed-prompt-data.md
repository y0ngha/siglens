# Precomputed prompt data — no arithmetic left to the LLM (2026-09-18)

Scope: every LLM prompt in siglens-core (siglens.io analyses + ai.siglens.io agent)
and every agent tool result in siglens (`src/app/api/ai/chat/tools/*`), plus the
ai.siglens.io chat scroll UX.

Principle: **if code can compute a number, code computes it.** The model picks
levels, weighs evidence and writes prose; it never subtracts, divides, sorts,
counts, converts units or measures distance. Every computed value follows the
null rule below.

## 0. Null / NaN rule (applies to every item)

- A derived number is `null` (JSON) or `N/A` (prompt text) unless every input is
  a finite number and the divisor is non-zero (for "% of base": base > 0).
- Never emit `NaN`, `Infinity`, `-0` or `N/A%` into a prompt or tool result.
  JSON: `null`. Text: `N/A`.
- Missing price quote (`0`, `null`, non-finite) = unknown, never 0.
- Percent fields are percent units (`3.2` = 3.2%), named `...Pct`; percentage-point
  deltas named `...Pp`. Rounded to 2 decimals unless the file already has a
  rounding helper (reuse it: `roundNumber`, `formatSignedPercent`, `fmtPercent`).
- Each helper gets a unit test covering: normal, zero base, negative base,
  NaN input, null input.

## 1. Audit findings (what the LLM was computing)

| # | Prompt / tool | LLM had to compute | Fix |
|---|---|---|---|
| A1 | technical `prompt.ts` riskReward prose | "손절 3% vs 목표 9% → 1:3" | deterministic text on every path (§2.3) |
| A2 | technical indicator section | price vs cloud / MACD vs signal & zero / +DI vs −DI / %K vs %D / MA stack / ATR% of price | `## Indicator State (computed)` (§2.2) |
| A3 | `skills/strategies/fibonacci.md` (siglens) | Fib retracement/extension prices | skill points at Market Reference Fib rows (already computed) |
| A4 | overall prompt | distance of key levels/targets from price (no price given at all) | snapshot price + per-level distance (§2.5) |
| A5 | fundamental prompt | peer premium, target upside (no price given), EPS estimate vs TTM, grade shares, target-trend change, days to earnings | §2.6 |
| A6 | financials prompt | margin change YoY | §2.7 |
| A7 | options prompt + agent options tool | max-pain distance, implied range, OI-strike distance/side, spread %, DTE (DTE missing entirely) | `summarizeChainForLlm` additions (§2.4) |
| A8 | news prompt / market news digest | sentiment tally, article age, days to earnings | §2.8 |
| A9 | market briefing | sector ranking, best−worst spread, breadth | §2.9 |
| A10 | macro briefing | indicator change vs previous, days to event | §2.10 |
| A11 | economic event | actual−estimate, actual−previous, beat/miss/inline direction | §2.11 |
| A12 | siglens.io chat prompt | any distance/%, has no price, no structured plan | §2.12 |
| B1 | agent `get_bars_indicators` | returns / 52w position / volume ratio / MA distances / ATR% from raw rows | `derived` block (§3.1) |
| B2 | agent `get_bars_indicators` | bar `t` + candle `date` are unmarked UTC while `asOf` is localized; daily `asOf` becomes a fake "09:00 KST" or previous day in US zones | §3.1 |
| B3 | agent `get_bars_indicators` | no higher timeframe; confluence HTF gate off | `higherTimeframe` + gate on (§3.1) |
| B4 | agent `get_cached_analysis` | stale = fixed 24h (weekend refreshes for nothing, intraday never stale); no link between analysis and price now | bar-based staleness + `sinceAnalysis` (§3.2) |
| B5 | agent `get_my_portfolio` | P/L, value, weight from qty × avg | §3.3 |
| B6 | agent `get_fundamentals` | ratio units ambiguous (0.25 vs 25%), target upside, days to earnings | §3.4 |
| B7 | agent `get_market_overview` | sector rank/breadth, sectors named only by ETF ticker | §3.5 |
| B8 | agent `get_economy` | deltas, 2s10s | §3.6 |
| B9 | agent `get_news` | tally, age | §3.7 |
| B10 | agent `get_quote` | `asOf` is fetch time, not quote time | §3.8 |
| B11 | overall redis hit | `generatedAt:null, stale:null` — never refreshed, time unknown | `analyzedAt` on `OverallAnalysisResponse` (§2.5) |
| P1 | agent prompt | no horizon, no analysis-vs-now rule, `entryTrigger` read as a buy signal, no "don't compute" rule | §2.1 |

## 2. siglens-core changes

### 2.1 Agent system prompt (`buildAgentSystemPrompt.ts`) + tool descriptions (`tools.ts`)
Bump `AGENT_PROMPT_VERSION`. Add to `### Rules` (only when the tool is available):
- **No arithmetic**: "Never compute a percentage, difference, ratio, sum, average, profit/loss, day count or unit conversion yourself. Tool results carry every computed figure you need (`derived`, `sinceAnalysis`, `pnl`, `upsidePct`, `…Pct` fields). If a figure you want is not in a result, describe the relationship in words without a number."
- **Horizon**: "Every directional read names its horizon from the timeframe it came from: 1Day bars → days to a few weeks; 4Hour/1Hour → a few days; 30Min and shorter → intraday to a day or two."
- **Analysis vs now** (when `get_cached_analysis` available): "`get_cached_analysis` carries `sinceAnalysis`. When `sinceAnalysis.levelsBroken` is non-empty or `movePct` is large relative to the levels, say SIGLENS's analysis predates that move and lead with the current bars/indicators; relay the analysis as the earlier view."
- **Confluence rules**: rename in text: `confluence.entryRuleMet` / `exitRuleMet` are rule states of an indicator tally, never a buy/sell instruction.
- **Higher timeframe** (bars): "`higherTimeframe` is the next larger timeframe's trend and tally; when it disagrees with the requested timeframe, say so."
Tool descriptions updated to name the new fields (§3). `get_bars_indicators` description: drop the `null below 120 bars` detail only if still true — keep accurate.

### 2.2 Technical prompt — `## Indicator State (computed)` section
New pure function in `domain/analysis/` (e.g. `indicatorState.ts`) rendered right after `## Indicator Values`. Lines (each `N/A` when inputs missing):
- `Price vs MA(p)/EMA(p)`: `above/below by ±x.xx%` for the MA/EMA periods already shown.
- `MA stack`: `bullish (MA5>MA20>MA60>MA120)` / `bearish (…<…)` / `mixed` using the configured `MA_DEFAULT_PERIODS` in order, only periods with values.
- `MACD`: `above/below signal`, `above/below zero`, histogram `rising/falling` (reuse `detectTrend` result already computed).
- `DMI`: `+DI above/below −DI`, ADX `≥25 trending / <20 weak / between`. (Use existing ADX thresholds constants if present; else define named constants.)
- `Stochastic`: `%K above/below %D`, zone `overbought ≥80 / oversold ≤20 / neutral`.
- `Ichimoku`: price `above cloud / inside cloud / below cloud` (cloud = min/max of senkouA/B), tenkan vs kijun.
- `Bollinger`: price position `above upper / upper half / lower half / below lower`.
- `Supertrend`, `Parabolic SAR`: price above/below + distance %.
- `ATR % of price`.
Guideline line in `analysisGuidelines`: "## Indicator State is computed; do not re-derive these comparisons." Tests: fixture indicators → exact lines; NaN/null inputs → `N/A`.

### 2.3 riskReward is always deterministic
- Prompt (`ANALYSIS_FIELD_GUIDANCE.actionRecommendation` + Step 3 `riskReward` bullet + Contingent Plan Mandate): the model no longer writes ratios or percentages in `riskReward`; it writes one or two sentences on what bounds the risk (stop reference) and the reward (target reference). Remove the `"손절 3% vs 목표 9% → 1:3"` examples.
- Normalization (where `planCheck` is attached, `ai-levels.ts` path): prepend `buildBullishRiskRewardText(entryTop-or-entry, stopLoss, takeProfitPrices)` on **every** path (not only reconciled) — result `"<deterministic line>\n\n<model prose>"`; when the deterministic line is `''`, keep the prose alone. Entry reference = same entry price `buildPlanCheck` uses for `riskRewardAtEntry`. Locale: the deterministic line is Korean today; for non-`ko` output locales render it in that locale (add a small per-locale template map in the same file: ko/en/ja/zh), since prose fields are not re-translated from Korean on those paths — verify how `reconciledLevels.riskReward` is localized today and follow the same path.
- Bump `PROMPT_TEMPLATE_VERSION` (`infrastructure/cache/config.ts`).

### 2.4 Options — `summarizeChainForLlm`
Add to `OptionsExpirationMetrics` (all optional-safe, null rule):
- `daysToExpiration` (from chain).
- `maxPainDistancePct` (maxPain vs underlying, signed).
- `impliedMoveRange: { low, high } | null` = price × (1 ∓ impliedMovePercent/100).
- `topOpenInterestStrikes[i].distancePct` (signed vs underlying) and `side: 'above' | 'below' | 'at'` (|d| < 0.5% = at).
- `topOiBidAskSummary[i].callSpreadPct` / `putSpreadPct` = spread / mid × 100.
When `underlyingPrice` is absent/invalid every price-relative field is `null`. Options prompt Interpretation Guide gains one line per new field. Consumers (siglens UI) must still compile — fields are additive.

### 2.5 Overall prompt + `analyzedAt`
- `formatTechnical` gains `- Snapshot Price: X` (last bar close from `bars` when provided, else omit line) and each support/resistance/target row gets `(±x.xx% from snapshot)`.
- `OverallAnalysisResponse.analyzedAt?: string` (ISO) set where the overall result is produced/cached (`runOverallAnalysis`), so peeks can report age. Optional field → old cache entries stay valid.

### 2.6 Fundamental prompt
- `FundamentalSnapshot.currentPrice?: number | null` (listing currency). siglens fills it.
- New lines: `Price Target Upside: consensus target vs current price ±x.x%` (N/A without price); `Price Target Trend: 1M vs 1Y avg ±x.x%`; `Peer median P/E / P/S` and `premium/discount vs peers ±x.x%` (peers with finite positive metric only; median; N/A if < 2 peers); `Analyst grades: buy share x%` (strongBuy+buy over total); `EPS estimate vs TTM EPS ±x.x%` (N/A when TTM ≤ 0); `Days to next earnings: N` (from `now` param — pass `now: Date` into the builder with default `new Date()` for testability).

### 2.7 Financials prompt
Per axis section, add a `Margin trend (latest vs prior same-period row)` line: gross/operating/net/FCF margin change in `pp`. Also `Liabilities / Equity` for latest balance row (N/A when equity ≤ 0).

### 2.8 News prompt + market news digest
- Header line: `Sentiment tally: N bullish / N bearish / N neutral (high impact: N bullish / N bearish)` computed from cards.
- Each item: `Published: <ISO> (<N>h ago | <N>d ago)` relative to a `now` param.
- Earnings calendar rows: `in N days` / `N days ago`.

### 2.9 Market briefing
- Sector rows sorted by change desc, prefixed with rank.
- Lines: `Breadth: N up / N down / N flat`, `Best − worst sector spread: x.xx%p`, `Index average change: ±x.xx%`.
- Rule text: leading/lagging must come from the top/bottom of the ranked list.

### 2.10 Macro briefing
- Indicator row: `latest (date) ← previous (Δ ±x.xx)`.
- Calendar row: `in N days`.

### 2.11 Economic event
- Precomputed: `actual − estimate = ±x.xx (above/below/in line)`, `actual − previous = ±x.xx (higher/lower/unchanged)`; in-line tolerance = named constant. Sentiment still the model's (polarity depends on indicator meaning — keep the existing rule).

### 2.12 siglens.io chat prompt (`buildChatPrompt.ts`)
- `Analysis generated: <analyzedAt>` when present.
- `Analysis-time price: X` from `actionRecommendation.planCheck.currentPrice` when present.
- Key levels / POC / targets each `(±x.xx% from analysis-time price)`.
- Structured plan block: entry range, stop, targets with % from entry, and `planCheck` ratios (at entry / at analysis-time price) + `belowStopLoss` / `exceedsEntryZone` flags.
- Rule: "Distances and ratios above are computed. Never compute others yourself; if asked for one not listed, say it isn't in the analysis."

## 3. siglens changes (agent tool results — contract names are exact)

### 3.1 `get_bars_indicators`
- Timestamps: bars `t` and `candlePatterns[].date` → `YYYY-MM-DD` for `1Day`; full ISO instant with `Z` for intraday (so `localizeTimestamps` converts them). `asOf` for `1Day` → `YYYY-MM-DD` (date only, not an instant). Intraday `asOf` unchanged.
- `derived` (null rule): `lastClose`, `changePct` {`1d`,`5d`,`20d`,`60d`} (bars back; null when not enough bars), `range52w` {`high`,`low`,`fromHighPct`,`fromLowPct`,`bars`} over the last ≤252 daily bars (for intraday: over all loaded bars, `bars` says how many), `volumeVsAvg20` (last volume / mean of previous 20), `atrPct`, `priceVsMa` {`ma20Pct`,`ma50Pct`,`ma200Pct`,`ema20Pct`…} for every MA/EMA period present, `maStack` `'bullish'|'bearish'|'mixed'|null`.
- `higherTimeframe`: `1Day` → weekly bars aggregated in core (`aggregateBarsToWeekly`, new pure fn, ISO weeks, UTC); `4Hour` → `1Day`; `1Hour` → `4Hour`; `30Min`/`15Min` → `1Hour`; `5Min` → `30Min`. Shape `{ timeframe, trend, confluenceScore, priceVsMa50Pct, rsi }` or `null` when unavailable. Pass the HTF bars to `evaluateConfluence({ htfBars, htfLabel })` and drop `htfGate: 'off'` (report `htfGate: 'on' | 'off'` truthfully).
- `confluence.entryTrigger`/`exitTrigger` → `entryRuleMet`/`exitRuleMet`.
- Budget: `fitBarsToBudget` still guarantees `BARS_RESULT_MAX_CHARS`; `derived`/`higherTimeframe` are small and must survive (they are outside `bars`).

### 3.2 `get_cached_analysis`
- Staleness (technical/overall): stale when the count of bars newer than `generatedAt` ≥ `STALE_NEW_BARS[timeframe]` = {1Day:1, 4Hour:2, 1Hour:4, 30Min:4, 15Min:6, 5Min:12}, or age > 7 days (hard cap). Bars from the same cached source the bars tool uses. If bars cannot be loaded, fall back to the old age rule.
- `sinceAnalysis` (technical, when a quote or last close is available): `{ analysisPrice, priceNow, movePct, levelsBroken: [{kind:'support'|'resistance', price}], nearestSupport: {price, distancePct}|null, nearestResistance: {…}|null, planNow: { riskReward, belowStopLoss, exceedsEntryZone } | null }`. `analysisPrice` = `planCheck.currentPrice` when present else null (then `movePct` null). `planNow` via core `buildPlanCheck` against `priceNow`.
- Overall redis hit: `generatedAt` from new `analyzedAt` (null when absent → `stale` falls back to bar rule with unknown age = stale:null as today).

### 3.3 `get_my_portfolio`
Per holding: `price` (quote, null when unavailable), `dayChangePct`, `marketValue`, `costBasis`, `pnl`, `pnlPct`, `weightPct` (of same-currency total value; null when currencies are mixed within total → compute weight per currency group and say `weightScope: currency`). Totals per currency: `{ currency, marketValue, costBasis, pnl, pnlPct }`. Quote failures → those fields null, holding still listed.

### 3.4 `get_fundamentals`
Rename ratio fields with explicit units (`roePct` etc., converted ×100 from FMP decimals — verify each source unit against the fundamental tab's existing formatter before converting). Add `price`, `targetUpsidePct` (consensus vs price), `daysToEarnings`, `analystBuySharePct`, `epsEstimateVsTtmPct`.

### 3.5 `get_market_overview`
Sectors sorted by `changesPercentage` desc with `rank` and display `name` (same name source the dashboard uses); `breadth {up, down, flat}`; `bestWorstSpreadPp`.

### 3.6 `get_economy`
Indicator `change` (latest − previous) and `direction`; `treasury.spread2s10s` via core `computeYieldSpread`, `curveInverted`; calendar `hoursUntil`.

### 3.7 `get_news`
`tally { bullish, bearish, neutral, highImpact }`, per item `ageHours`.

### 3.8 `get_quote`
`asOf` = provider quote timestamp when the provider returns one; else keep fetch time and add `asOfIsFetchTime: true`.

### 3.9 Chat scroll UX (`widgets/agent-chat`)
- On send (new user message appended by the user): scroll that message to the top of the viewport (ChatGPT/Gemini anchor pattern); the active turn gets `min-height` = log viewport height so the anchor can reach the top; no auto-follow while the answer streams.
- Conversation open/switch: `key={conversationId}` on `MessageList`; jump to bottom instantly.
- "Scroll to bottom" button when more than 80px from the bottom; smooth scroll unless `prefers-reduced-motion`.
- Tests for each behaviour.

## 4. Release order
1. core PR → review → APPROVED → merge → tag `v1.11.0` (release workflow) → verify tarball.
2. siglens PR: tools (3.1–3.8) + scroll (3.9) + fibonacci skill text + bump core + wiring (`FundamentalSnapshot.currentPrice`, overall `analyzedAt`).

## 5. Decisions made during implementation (2026-09-19)

- **Arithmetic policy.** Computed figures are always quoted, never recomputed.
  Conversational prompts (agent, siglens.io chat) may compute a figure no tool
  provides, from numbers in tool results / analysis data, showing inputs and the
  operation. Analysis prompts may do simple prose arithmetic; structured price
  fields (keyLevels, priceTargets, entry/stop/TP, geometry) take only prices that
  appear in the data.
- **Complete reference tables.** Market Reference keeps the capped nearest-level
  lists and adds per-horizon `Fib table:` / `Fib ABC table:` lines and one
  `Pivot table:` line, so far levels are quoted, not computed.
- **Chart patterns.** The pre-screener's candidates are hints, not a filter.
  The model may report any chart pattern it sees (catalog or not; candle patterns
  excluded) and fills `geometry`; the app computes measured / conservative
  targets. Candidates print breakout, extreme, direction, height, targets and
  invalidation so a copied geometry reproduces the listed targets exactly.
  Triangle/wedge height = widest gap (pattern start); lines past the apex fall
  back to the last pivot; degenerate shapes render `geometry unavailable`.
- **Price targets.** Chosen from levels in the prompt (keyLevels, Market
  Reference rows and tables, listed pattern targets); never projected.
- **Analyst estimates.** FMP's annual consensus is newest-first up to five years
  ahead; the provider now takes the fiscal year in progress (cache key
  `fundamental:estimates:v2`). The agent tool exposes it as `analystEstimate`
  with `period` (`current_fiscal_year` US / `current_quarter` KR).
- **Removed.** EPS estimate vs TTM (periods differ).
