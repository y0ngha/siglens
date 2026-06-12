---
name: chart-indicator-rendering
description: Review patterns for the widgets/chart indicator-rendering hooks/registry feature wave (v0.20.4→ render-* PRs)
metadata:
  type: project
---

The `widgets/chart` indicator-rendering wave (PRs #575–#588, ~34 indicators) added a uniform set of LWC hooks, a registry, and color/label utils. This is correctly **siglens territory**: it renders indicators already computed in `@y0ngha/siglens-core` (pure presentation/rendering, SCOPE.md Step 1/6). Do NOT flag these as analysis-logic-leak — they only import core *types* + *result arrays* and draw them.

**Established hook patterns (all correct, do not re-flag):**
- Pane hooks (`useXChart`) take `isVisible` + `paneIndex` as params (registry-driven via `useIndicatorVisibility`). Overlay hooks (`useXOverlay`) own their own `isVisible` useState + `toggle`. Both shapes are intentional and coexist.
- Two effects per hook: (1) series create/remove keyed on `[chartRef, isVisible, paneIndex]`, (2) setData keyed on `[indicators, bars, isVisible, paneIndex]`. `useEffectEvent` wraps clearSeriesRefs/removeAllSeries to escape exhaustive-deps. Effect declaration order guarantees create-before-setData.
- `bar.time as UTCTimestamp` cast is the accepted safe-cast (LWC branded number == epoch seconds), always carries a guarantee comment.
- `Object.fromEntries(...) as Record<IndicatorKey, T>` casts in registry/visibility are safe (registry declares all keys) and carry guarantee comments.

**Local constants are scope-correct:** `constants/indicatorLevels.ts` (MFI/CRSI/CMF/Williams%R thresholds) stay in siglens because they're *visualization* thresholds, not analysis rules, AND core 0.20.0 barrel doesn't export them. Documented per MISTAKES.md 16.5. Do not flag as scope violation.

**Recurring real finding — color RGB drift (MISTAKES.md #15):** `histogramColorUtils.regressionBarColor` hardcodes `'38, 166, 154'`/`'239, 83, 80'` RGB literals that duplicate `CHART_COLORS.regressionUp`/`regressionDown` hex (#26a69a/#ef5350) because it needs runtime alpha. The test also hardcodes the same RGB, so neither follows a hex change → single-source-of-truth broken. Recommended-level. A robust fix derives RGB from the hex constant.
