---
name: Regression R-Squared Signal Guide
description: 롤링 선형회귀 R² 신호 해석 가이드 — 추세 청결도 컨디셔너, 방향 무관, 윈도우 스케일 유의성
type: indicator_guide
indicators: ['regression']
confidence_weight: 0.45
usage_roles: [regime]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: regression
    predicate: level
token_cost: 346
digest_hash: "68ded38b"
---

## Overview

Rolling linear-regression R² measures **trend cleanliness** — how well a straight line fits price over a trailing window.

- **Formula**: regress price on time over the window; `R² = 1 − SS_res / SS_tot ∈ [0,1]` (equivalently the squared price–time correlation). R² ≈ 0 = choppy / no linear trend; R² ≈ 1 = a clean, straight trend.
- **Direction-blind**: R² says only *how cleanly* price trends, never *which way*. It must be paired with the regression slope sign to get direction.

## Signal Interpretation — Trend-Cleanliness Conditioner

- **High R²** → price is trending cleanly: up-weight trend-following, do *not* fade the move.
- **Low R²** → chop / range: up-weight mean-reversion (e.g. the Bollinger %B short), down-weight breakout bets.
- Combine with **slope sign** for direction: high R² + positive slope = clean uptrend; high R² + negative slope = clean downtrend.
- The **state gate fires when r² clears a significance cutoff** (≈0.3 for the default ~20-bar window).

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.45** — a conditioner, not a directional signal. R² is cheap and has explicit, interpretable thresholds, which is why it rates medium-to-high *as a trend-confirmation conditioner*; but it is **direction-blind**, so it never stands alone. There is no directional t-stat to report.

## Recommended Combinations

- **Regression R² + slope sign**: the minimum viable pairing — R² grades cleanliness, slope supplies direction.
- **Regression R² + Hurst + Variance Ratio**: the regime lens. High R² agreeing with H > 0.5 and VR > 1 is a confident clean-trend regime.
- **Regression R² as a weight on directional skills**: suppress counter-trend reversion events when R² is high; favor them when R² is low.

## Caveats

- **Window-scaled significance is mandatory.** R² rises mechanically as the window shrinks, so a *fixed* cutoff is a bug. The 95% critical-R² scales with lookback: n=5 → 0.77, n=14 → 0.27, n=20 → 0.20, n=30 → 0.13, n=60 → 0.06, n=120 → 0.03. The gate's ≈0.3 cutoff is a conservative simplification for the default ~20-bar window — read it against the table, not as universal.
- **Direction-blind**: never infer a side from R² alone.
- Assumes a *linear* trend — parabolic / accelerating moves score lower R² than their strength implies, and the result is sensitive to the price transform (raw vs log).

<!-- PROMPT_DIGEST:START -->
### Regression R² — trend-cleanliness conditioner (direction-blind)

- Measures how cleanly price trends over trailing window; R²∈[0,1]. R²≈0 = choppy/no linear trend; R²≈1 = clean straight trend.
- **Direction-blind**: says only *how cleanly*, never which way — pair with regression slope sign for direction.
- **High R²** → trending cleanly: up-weight trend-following, do NOT fade the move.
- **Low R²** → chop/range: up-weight mean-reversion (e.g. Bollinger %B short), down-weight breakout bets.
- High R² + positive slope = clean uptrend; high R² + negative slope = clean downtrend.
- State gate fires when R² clears a significance cutoff (≈0.3 for default ~20-bar window).
- Confidence **0.45** — conditioner, never stands alone; no directional t-stat.
- **Window-scaled significance mandatory** (fixed cutoff = bug; R² rises mechanically as window shrinks). 95% critical-R²: n=5→0.77, n=14→0.27, n=20→0.20, n=30→0.13, n=60→0.06, n=120→0.03. Read the ≈0.3 gate against this table, not as universal.
- Combos: +slope sign (min viable pairing); +Hurst+Variance Ratio (regime lens — high R² agreeing with H>0.5 and VR>1 = confident clean-trend). Use as weight on directional skills: suppress counter-trend reversion when R² high, favor when low.
- Caveats: assumes linear trend (parabolic/accelerating scores lower than strength implies); sensitive to price transform (raw vs log).
<!-- PROMPT_DIGEST:END -->
