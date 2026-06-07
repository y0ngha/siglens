---
name: EWMA Volatility Signal Guide
description: EWMA 변동성(RiskMetrics, λ=0.94) 신호 해석 가이드 — 반응형 위험 척도, VaR/사이징, 변동성 레짐 (방향 없음)
type: indicator_guide
indicators: ['ewmaVolatility']
confidence_weight: 0.3
usage_roles: [measurement, risk]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: ewma
    predicate: level
token_cost: 0
---

## Overview

EWMA (exponentially weighted moving average) volatility is the RiskMetrics estimator from J.P. Morgan/Reuters (RiskMetrics Technical Document, 4th ed., 1996, Ch. 5). It is the standard reactive volatility forecast used in VaR.

- **Formula**: `σ²_{t+1|t} = λ · σ²_{t|t−1} + (1 − λ) · r²_t`, which expands to `σ² = (1 − λ) · Σ λ^{t−1} r²_t`. The daily decay is λ = 0.94 (half-life ~11 days); λ = 0.97 for monthly. The forecast uses only past returns — **no look-ahead**.
- **Why over an SMA of squared returns**: EWMA reacts faster to shocks, decays smoothly, and avoids the SMA "ghosting" artifact where a single large return drops out of the window and the estimate jumps.

## Signal Interpretation — Measurement Only

EWMA is **pure measurement: it has no direction.**

- Use the level as a **dynamic risk scale** — for VaR, position sizing, and gauging the current volatility regime.
- Use **expanding vs contracting** EWMA to contextualize signals: a fresh shock spikes EWMA fast; a calm tape decays it smoothly.
- The **state gate fires when reactive vol reaches a top/bottom regime extreme** over its recent window, not on any directional condition.

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.3** — measurement, **directional weight 0**. There is no forward-edge t-stat because EWMA makes no directional claim; it is a risk/sizing input. It is the right tool when you want a fast, reactive volatility forecast that responds to the latest shock.

## Recommended Combinations

- **EWMA + position sizing / VaR**: scale exposure to the EWMA level — the use it was designed for.
- **EWMA vs Yang-Zhang divergence**: EWMA is a reactive return-based forecast; Yang-Zhang is an efficient realized/OHLC read. Their divergence flags intraday churn versus close-to-close drift and is itself informative.
- **EWMA + any directional signal**: never as the signal — only to size the trade and read the volatility regime.

## Caveats

- **No direction** — a volatility level is never bullish or bearish.
- **λ = 0.94 is an empirical convention, not a constant**: RiskMetrics chose it by RMSE-minimizing the optimal λ per series across 480 series, then accuracy-weighted-averaging — it is not optimal for any single asset.
- EWMA is a restricted **IGARCH with no mean reversion**: it produces flat-horizon forecasts and over-persists after a shock. It is also single-fixed-memory, λ-sensitive, and assumes normality (so it underestimates tails). Use it as a reactive scale, not a regime forecaster.
