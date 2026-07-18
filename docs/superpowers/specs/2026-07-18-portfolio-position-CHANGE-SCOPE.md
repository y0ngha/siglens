# Portfolio Position Visualization (Subsystem B) — Change-Scope Spec

- **Date**: 2026-07-18
- **Branch**: `feat/portfolio-position-viz` (stacked on `feat/portfolio-holdings-foundation` = Subsystem A, PR #691)
- **Design**: `docs/superpowers/specs/2026-07-18-portfolio-position-viz-design.md`
- **Purpose**: enumerate exactly WHAT changed so empirical verification (see `2026-07-18-portfolio-position-TEST-CASES.md`) has a precise target.

---

## 1. What changed (files)

Diff base: `feat/portfolio-holdings-foundation...HEAD`.

### New widget slice — `src/widgets/portfolio-position/`
- `index.ts` — barrel, exports only `PositionSectionMounted`.
- `lib/positionGeometry.ts` — pure geometry: `computePosition(PositionInputs): PositionModel | null`. No time/random/DOM. Guards return `null` on degenerate range / non-finite / non-positive avg or current.
- `ui/PositionSectionMounted.tsx` — LIGHT presence gate (`'use client'`): `useHydrated()` + `useCurrentUser()` only. Renders `null` until hydrated and `null` for a guest. When gated in, `next/dynamic(..., { ssr: false })`-loads `PositionSection`.
- `ui/PositionSection.tsx` — lazy inner (`'use client'`): calls `useSymbolHolding(symbol)`; `null` if no holding; runs `computePosition`; `null` if model is `null`; else renders `PositionCard`.
- `ui/PositionCard.tsx` — card chrome (`bg-secondary-800 rounded-lg`) + heading + `PositionGauge` + `<dl>` readouts.
- `ui/PositionGauge.tsx` — hand-rolled `<svg viewBox="0 0 260 260">`, `role="img"` + Korean `aria-label`; 5×20% neutral bands, gridlines, high/low tick labels, two markers (◆ 내 평단, ▶ 현재가), in-SVG compact `$…K` labels ≥ $100k, avg≈current dodge, out-of-range note.
- `__tests__/` — `positionGeometry.test.ts`, `PositionGauge.test.tsx`, `PositionCard.test.tsx`, `PositionSectionMounted.test.tsx`.

### Mount point — `src/views/symbol/ChartContent.tsx` (only product-code file touched)
- New import `buildTechnicalFacts` (in-slice, `./utils/technicalFacts`) and `PositionSectionMounted` (`@/widgets/portfolio-position`).
- New `const facts = useMemo(() => buildTechnicalFacts(bars, indicators), [bars, indicators])`.
- `PositionSectionMounted` rendered inside `analysisContent` (both the has-narrative and the no-narrative branch), adjacent to `TechnicalFactsSummary`, guarded by `{facts && …}`, receiving primitive number props `symbol / low52w={facts.low52w} / high52w={facts.high52w} / lastClose={facts.lastClose}`.
- `facts` added to the `analysisContent` `useMemo` dependency array (markers don't go stale on a bars refetch).

### Tests / config (non-product)
- `e2e/specs/portfolio-position.spec.ts`, small additions to four `ChartContent` test files, `playwright.config.ts`.

**Not changed:** `TechnicalFactsSummary` (no hoist, no prop change), `app/[symbol]/page.tsx`, any `entities/portfolio` / `features/portfolio-holding` file, any `@y0ngha/siglens-core` file. No route, no DB/migration, no env, no core release.

---

## 2. User-visible behavior

A member-only "내 위치" position gauge appears on the symbol chart tab, in the analysis panel next to the technical-facts summary (both the desktop `<aside>` and the mobile analysis bottom sheet, `SNAP_PEEK`).

It shows ONLY when ALL hold:
1. Client is hydrated (`useHydrated()`), and
2. a member is present (`useCurrentUser()`), and
3. a holding exists for THIS symbol (`useSymbolHolding(symbol).holding`), and
4. `computePosition` returns non-null (valid recent high/low range + finite positive avg & current).

For everyone else — guests, members without a holding for this symbol, unhydrated first paint, degraded/degenerate range — it renders nothing (no error, no placeholder).

The gauge shows: the recent high/low banded range, the member's average-price marker (◆ 내 평단) and current-price marker (▶ 현재가), plus readouts: 최근 고점 / 최근 저점 / 현재가 / 내 평단 / 최근 고점 대비 / 최근 저점 대비 / 수익률 / 최근 범위의 위치. Copy is timeframe-neutral ("최근", never "52주"), matching `TechnicalFactsSummary`.

---

## 3. Key invariants

1. **Client-only + member-gated → not in crawlable SSR HTML → ISR intact.** `PositionSectionMounted` is `'use client'` and gates on `useHydrated()`; the inner `PositionSection` is `next/dynamic(..., { ssr: false })`. It is mounted inside `ChartContent`, NOT in `app/[symbol]/page.tsx`'s Suspense fallback (the server/SEO path). Therefore the gauge markup never enters server-rendered HTML, `/[symbol]` stays statically ISR-generated (`revalidate = 21600`, `generateStaticParams` on-demand), and the crawlable SSR HTML is byte-identical for members and guests.

2. **Guest fires ZERO holdings query and downloads ZERO gauge bundle.** The light outer gate (`useHydrated` + `useCurrentUser`, no `useSymbolHolding`) returns before the lazy `next/dynamic` import. A guest never mounts `PositionSection`, so its chunk is never requested and `getPortfolioHoldingsAction` never fires. `useSymbolHolding` lives only in the lazy inner.

3. **Pure geometry / scope fence — no analysis semantics.** `positionGeometry.ts` produces only coordinates and display percentages (avgPos, currentPos, pctFromHigh, pctAboveLow, returnPct, rangePositionPct, 20% bands). No "buy/sell/overheated/oversold/near-support" meaning; band color is a NEUTRAL `secondary-*` gradient, deliberately not high=red. This keeps B display-format arithmetic (same class as `technicalFacts.ts`), NOT an indicator/signal/threshold rule → passes the SCOPE guard, zero `@y0ngha/siglens-core` change. (Feeding avg price into AI analysis is Subsystem C, which needs a core release — explicitly out of scope here.)

4. **Timeframe-neutral copy.** Range is the last 252 bars of whichever timeframe is selected, so all copy says "최근" (최근 고점 / 최근 저점 / 최근 범위 …), never "52주".

5. **Degrade-to-null on bad range / no holding.** No bars or FMP-degraded → `buildTechnicalFacts` yields no usable range → `{facts && …}` guard or `computePosition() === null` → widget renders nothing. No holding for the symbol → `PositionSection` returns `null`. avg outside the recent [low, high] → marker clamps to the edge and an out-of-range note renders ("최근 고점보다 높은 곳에서 매수" / "최근 저점보다 낮은 곳에서 매수"); the widget still shows.

6. **`TechnicalFactsSummary` untouched.** It computes its own range internally and is rendered in TWO trees (server component in the SSR Suspense fallback + client in `ChartContent`). Its prop signature is unchanged; `ChartContent` calls `buildTechnicalFacts` a second time and passes primitive numbers down, so the SSR/SEO fallback path and `TechnicalFactsSummary.test.tsx` / `page.factlayer.test.tsx` are unaffected.

---

## 4. Stacking note

B is **stacked on A** (Subsystem A = portfolio holdings foundation, PR #691, providing `entities/portfolio` + `useSymbolHolding`). B's branch `feat/portfolio-position-viz` is based on A's branch `feat/portfolio-holdings-foundation`.

- **A must merge first**, or B's PR targets A's branch (rebase B onto master once A merges).
- B introduces **no migration and no env of its own** — it consumes only primitive numbers (from `buildTechnicalFacts`) plus the holding surfaced by A's `useSymbolHolding`.
