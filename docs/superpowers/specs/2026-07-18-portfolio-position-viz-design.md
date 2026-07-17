# Portfolio Position Visualization (Subsystem B) — Design

- **Date**: 2026-07-18
- **Status**: Design (pending implementation)
- **Depends on**: Subsystem A (portfolio holdings foundation, PR #691 — `entities/portfolio`, `useSymbolHolding`). This branch (`feat/portfolio-position-viz`) is stacked on A's branch.
- **Position**: Subsystem **B** of the member portfolio feature (`A → B → D → C`).

## 1. Goal

Show a logged-in member **where their average purchase price sits** for a symbol — did they buy near the 52-week high or low? A vertical, banded range gauge marks the member's average price and the current price against the 52-week high/low range, with profit/loss and range-position context.

## 2. Confirmed decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Visual form | **Vertical banded range gauge** (52-week high→low, 20% bands, avg-price + current-price markers) |
| Range basis | **52-week high/low only** (no detected-key-level overlay) |
| Cross-repo scope | **siglens-local, ZERO `@y0ngha/siglens-core` changes** (raw range % arithmetic, same class as the existing `technicalFacts.ts` — passes the SCOPE guard §6: display-format arithmetic, not an indicator/signal/threshold rule) |

## 3. Data sources (all client-side, already available)

- **Range + current price**: `buildTechnicalFacts(bars, indicators)` (`src/views/symbol/utils/technicalFacts.ts`) already computes `high52w`, `low52w`, `lastClose` from the last 252 bars. B reuses this — it does NOT recompute the range from scratch and does NOT add any core logic.
- **Member's average price**: `useSymbolHolding(symbol)` (`src/features/portfolio-holding/hooks/useSymbolHolding.ts`) → `{ holding: { averagePrice: string, quantity: string, ... } | null, isHydrated, isLoading, isError }`. Parse `Number(holding.averagePrice)` for the marker.
- **Bars**: `useBars` (`useSuspenseQuery`) already supplies bars/indicators on the chart tab.

## 4. Pure computation (testable, siglens-local)

New pure module `widgets/portfolio-position/lib/positionGeometry.ts`:

```ts
export interface PositionInputs {
    low52w: number;
    high52w: number;
    current: number;   // lastClose
    avg: number;       // member avg price
}
export interface PositionModel {
    // normalized 0..1 positions within [low, high] (clamped)
    avgPos: number;
    currentPos: number;
    avgClamped: 'above' | 'below' | null;   // avg outside the 52w range
    currentClamped: 'above' | 'below' | null;
    // display percentages
    pctFromHigh: number;      // (avg - high) / high * 100  (negative below high)
    pctAboveLow: number;      // (avg - low) / low * 100
    returnPct: number;        // (current - avg) / avg * 100  (P&L on the position)
    rangePositionPct: number; // avgPos * 100 (where in the band, %)
    bands: readonly { fromPct: number; toPct: number }[]; // 20% bands
}
export function computePosition(input: PositionInputs): PositionModel | null;
```

**Validity / null (widget renders nothing):** `computePosition` returns `null` when ANY of these hold — the guards are load-bearing (critical review found real div-by-zero cases):
- `high52w <= low52w` (degenerate range → `(high-low)` normalization div-by-zero).
- `avg <= 0` or `!Number.isFinite(avg)` (a stray empty `averagePrice` → `Number('')===0` → `returnPct` Infinity). Same for `current`.
- any input `NaN`/non-finite.

**Field guards** (mirror the existing precedent `technicalFacts.ts:121`):
- `pctAboveLow`: when `low <= 0`, return `0` (do NOT divide by `low`). `pctFromHigh` is safe once range-valid (`high > low >= 0 ⇒ high > 0`) but apply the same defensive `high > 0` short-circuit for parity.

- **Clamp**: if `avg > high52w` → `avgPos = 1`, `avgClamped = 'above'` ("52주 고점보다 높은 곳에서 매수"); if `avg < low52w` → `avgPos = 0`, `avgClamped = 'below'`. Same for current. Handles the "초고점에서 샀는지" case.
- `Number(decimalString)` is acceptable (presentation-only, not persisted), **paired with the finite/`>0` guards above**.
- Bands generated inclusive-low / exclusive-high so `avgPos === 0.2` lands deterministically in the second band.

> **⛔ Scope fence:** `positionGeometry.ts` must stay PURELY GEOMETRIC — no "buy/sell/overheated/oversold/near-support" semantics. The moment the avg-vs-range relationship acquires analysis *meaning*, it crosses into `@y0ngha/siglens-core` (that is subsystem C, gated on a core release). B is presentation geometry only.

## 5. UI

New widget slice **`widgets/portfolio-position`** (mirrors `widgets/fear-greed`):
- `ui/PositionGauge.tsx` — a hand-rolled `<svg viewBox>` (FearGreedGauge idiom): a vertical bar split into 5×20% bands, `role="img"` + a descriptive Korean `aria-label` embedding avg / current / returnPct / range-position. Two markers: **내 평단** (◆) and **현재가** (▶), positioned by `avgPos`/`currentPos`.
  - **Band palette — NEUTRAL gradient, not high=red.** Do NOT encode "near-high = danger" (a critical-review + product concern: it reads as a false sell-signal and edges toward analysis semantics). Use a subtle neutral gradient of `secondary-*` tones (top slightly lighter → bottom slightly darker, or a uniform low-emphasis fill) via `currentColor` (FearGreed idiom). The MEANING is carried by the markers + the colored readouts, not by band color. Explicit band→token table (top→bottom band 1..5): `text-secondary-600/40`, `text-secondary-600/30`, `text-secondary-700/30`, `text-secondary-700/40`, `text-secondary-800/40` (tune for contrast; no raw Tailwind palette, no `chart-*` on bands). Gridlines at each 20% in `secondary-700`.
  - **Marker overlap (avg ≈ current):** when `|avgPos - currentPos|` is within a small epsilon, dodge — offset the two markers horizontally (◆ left of the bar, ▶ right of the bar) and/or stack their value labels so break-even (the most common state) stays readable.
  - `lastClose` (current) MUST come from the same `facts` source that feeds `TechnicalFactsSummary` so the two never disagree.
- `ui/PositionCard.tsx` (or inline) — the surrounding card with the readouts: 52주 고점/저점, 현재가, 내 평단, 고점대비 %, 저점대비 %, **수익률**(returnPct), 범위 내 위치 %. Card chrome matches the technical-facts/account cards.
  - **Color tokens (DESIGN.md §AA):** the small-text readouts (`수익률`, `% 대비`) use `text-ui-success-text` (≥0) / `text-ui-danger-text` (<0) — the AA-contrast text variants, NOT `text-chart-bullish/bearish` (chart-* is graphics-only). Neutral labels use `text-secondary-400`.
- `ui/PositionSectionMounted.tsx` — gating wrapper: renders only when a member is present AND has a holding for this symbol AND `computePosition` is non-null. Uses `useSymbolHolding(symbol)`; renders `null` until hydrated (mirror `PortfolioChipMounted`, incl. an explicit `useCurrentUser` presence gate as belt-and-suspenders). No holding / guest / degraded-range → `null`.
- `index.ts` barrel → `PositionSectionMounted`.

**Copy** (Korean, verify against components at build time): heading `내 위치`, marker labels `내 평단` / `현재가`, `수익률 +11%`, `52주 고점 대비 -16%`, `52주 저점 대비 +30%`, range note `52주 범위의 54% 지점`, out-of-range note `52주 고점보다 높은 곳에서 매수` / `52주 저점보다 낮은 곳에서 매수`. `aria-label` example: `"AAPL 내 위치: 평단 $300, 현재가 $333, 수익률 +11%, 52주 범위의 54% 지점"`.

**Mobile:** the widget also lands in the mobile analysis bottom sheet (`SNAP_PEEK`). Give the gauge a defined `min-height` and a compact form so it stays legible in the height-constrained sheet.

## 6. Render location

Mount `PositionSectionMounted` **client-side only**, inside `ChartContent.tsx`'s `analysisContent` JSX, adjacent to `TechnicalFactsSummary`. It then appears in both the desktop `<aside>` and the mobile analysis sheet automatically. **Do NOT** add it to the `app/[symbol]/page.tsx` Suspense fallback (that is the server/SEO path — the widget must stay out of crawlable SSR HTML).

- **DO NOT hoist / change `TechnicalFactsSummary`** (critical-review: highest-risk item). `TechnicalFactsSummary` computes the range internally AND is rendered in TWO trees — a **server component in the SSR Suspense fallback** (`app/[symbol]/page.tsx`, the crawlable SEO path, fed quantized server bars) AND client in `ChartContent` (fed live `useBars` bars). Changing its prop signature would ripple into the SSR/SEO call site and break `TechnicalFactsSummary.test.tsx` / `page.factlayer.test.tsx`. Leave it untouched.
- Instead: in `ChartContent`, add `const facts = useMemo(() => buildTechnicalFacts(bars, indicators), [bars, indicators])` (importing `./utils/technicalFacts` is in-slice for `views/symbol` — legal) and pass `facts.low52w / facts.high52w / facts.lastClose` as **primitive number props** to the widget (widget never imports from `views`). The trivial second `Math.max/min` over ≤252 in-memory bars is negligible — accept it.
- Add the new range primitives to the `analysisContent` `useMemo` dependency array so the markers don't go stale on a bars refetch.

## 7. Gating, edge cases, resilience

- **Visibility**: member + holding-for-this-symbol + valid range only. Mirrors A's presence gating (not tier). Not rendered for guests / no-holding / degraded.
- **avg outside 52w range**: clamp marker + show the out-of-range note (§4/§5).
- **No bars / FMP degraded**: `buildTechnicalFacts` yields no usable range → `computePosition` returns `null` → widget renders nothing (no error).
- **Hydration**: render `null` until `useSymbolHolding` hydrated (no SSR/ISR impact — client-only, like the chip; must not enter crawlable SSR HTML or force `[symbol]` dynamic).
- **P&L note**: `returnPct` uses `current` vs `avg` (unrealized return on the position), colored bullish (≥0) / bearish (<0) per chart tokens.

## 8. FSD / boundaries

- `widgets/portfolio-position` is a widget → may consume `features/portfolio-holding` (`useSymbolHolding`), `shared`, and `entities`. Mounted by `views/symbol` (pages layer) → widget: allowed.
- `buildTechnicalFacts` (views/symbol/utils) is called by the PARENT (`ChartContent`, in-slice) which passes primitive range numbers down as props. The widget takes primitives; it does NOT import from `views` (that would be an upward widget→pages violation).
- **No `@y0ngha/siglens-core` change.** The widget consumes only primitive numbers + the holding. (Confirmed by scope exploration; only C touches core.)

## 9. Testing (90%)

- **vitest**: `computePosition` pure math — normal, avg-above-high (clamp), avg-below-low (clamp), current clamp, **degenerate range `high<=low` → null**, **`low=0` → pctAboveLow guarded (no div-by-zero)**, **`avg=0` / `avg=NaN` / `avg=''`→`Number`=0 → null**, `current<=0` → null, returnPct sign, rangePositionPct, inclusive-low/exclusive-high band boundaries (e.g. avgPos===0.2).
- **component**: `PositionGauge` (marker positions, aria-label string content, out-of-range note, band rendering, avg≈current dodge), `PositionSectionMounted` (hidden for guest / no-holding / unhydrated / degraded-range; shown for member-with-holding), color-token correctness (readouts use `ui-*-text`).
- **playwright** (authed): a member with a holding on `/AAPL` sees the position gauge with their avg marker; a member without a holding does not; guest does not.

## 10. Risks & open items

- **Stacked on A (PR #691, unmerged).** B's branch is based on A's branch; B's PR targets A's branch (or master once A merges). Rebase if A changes.
- **`TechnicalFactsSummary` — do NOT touch** (critical review resolved this): no hoist, no prop change; `ChartContent` computes its own `useMemo(buildTechnicalFacts)` and passes primitives. This keeps the SSR/SEO fallback path and its tests untouched.
- **Band-color = neutral, not high=red** — deliberate, to avoid encoding a false sell-signal and to keep B out of analysis-semantics (scope fence). Meaning lives in markers + colored readouts.
- **Not C.** B deliberately does not feed the avg price into AI analysis (that's C, which needs a core release). B is presentation-only.
