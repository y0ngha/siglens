---
name: Yang-Zhang Volatility Signal Guide
description: 양-장 변동성 신호 해석 가이드 — 효율적 실현 변동성 측정(드리프트 독립·점프 정합), 사이징·스톱 거리 (방향 없음)
type: indicator_guide
indicators: ['yangZhang']
confidence_weight: 0.3
usage_roles: [measurement, risk]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: yangZhang
    predicate: level
token_cost: 0
---

## Overview

Yang-Zhang volatility was introduced by Dennis Yang and Qiang Zhang (2000, Journal of Business 73(3):477–492). It is a minimum-variance OHLC volatility estimator that is both drift-independent and consistent in the presence of opening jumps.

- **Formula**: `σ²_YZ = σ²_overnight + k · σ²_open-to-close + (1 − k) · σ²_RS`, with `k = 0.34 / (1.34 + (n+1)/(n−1))`. The components are the overnight gap `ln(O / prevC)`, the open-to-close `ln(C / O)`, and the Rogers-Satchell drift-independent intraday term.
- **Why it exists**: it combines the three terms in minimum-variance proportions, capturing overnight jumps while remaining drift-independent — a fast, low-noise realized-volatility read from relatively few bars.

## Signal Interpretation — Measurement Only

Yang-Zhang is **pure measurement: it has no direction.**

- Use the level to set **stop distance** and **position size** — wider stops and smaller size when YZ is high, tighter and larger when it is low.
- Use **expansion vs contraction** to contextualize follow-through: a signal firing into an expanding-vol regime has more room to run; into a contracting regime, less.
- The **state gate fires when realized vol reaches a top/bottom regime extreme** over its recent window (volatility-regime notability), not on any directional condition.

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.3** — measurement, **directional weight 0**. There is no forward-edge t-stat because Yang-Zhang makes no directional claim; it is a risk/sizing input, not a signal. It is most useful precisely where you need a fast, low-noise volatility read from few bars.

## Recommended Combinations

- **Yang-Zhang + position sizing / stops**: scale risk to the YZ level; pair with the ATR-based Chandelier Exit for a coherent volatility-aware stop.
- **Yang-Zhang vs EWMA divergence**: YZ is an efficient realized/OHLC read; EWMA is a reactive return-based forecast. A divergence between them is itself informative (intraday churn vs close-to-close drift).
- **Yang-Zhang + any directional signal**: never as the signal — only to size the trade and judge whether the volatility backdrop supports follow-through.

## Caveats

- **No direction** — never read a volatility level as bullish or bearish.
- The "dramatic" efficiency in the abstract gives **no fixed multiplier**; "up to ~14×" is a theoretical ceiling, ~7–8× is typical (MIT OCW). Do not over-claim its precision.
- It carries discreteness / bad-tick bias and is a *historical* estimator — it lags regime breaks more than a close-to-close measure in a fast shock.
