---
name: Variance Ratio Signal Guide
description: 분산비율(Lo-MacKinlay) 신호 해석 가이드 — 통계적으로 가장 견고한 레짐 분류기(유의성 검정 내장)
type: indicator_guide
indicators: ['varianceRatio']
confidence_weight: 0.5
usage_roles: [regime]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: varianceRatio
    predicate: level
token_cost: 0
---

## Overview

The Variance Ratio test is due to Andrew Lo and A. Craig MacKinlay (1988, Review of Financial Studies 1(1):41–66) — the classic statistical test of the random-walk hypothesis.

- **Formula**: `VR(q) = Var(q-period return) / [q · Var(1-period return)]`. Under a random walk variance scales linearly with horizon, so VR(q) ≈ 1. VR > 1 = positive autocorrelation / trending; VR < 1 = negative autocorrelation / mean-reverting.
- **Significance**: the homoskedastic statistic is `Z(q) = (VR − 1) / √φ(q)` with `φ(q) = 2(2q−1)(q−1) / (3qT)`; the heteroskedasticity-robust `Z*(q)` (1990 erratum) is essential under GARCH. Use overlapping returns and a bias-corrected denominator.

## Signal Interpretation — Regime Conditioner

VR is the **most statistically grounded regime classifier** of the three because it ships with a significance test, not just a threshold.

- **VR > 1 and Z\* significant** → trend regime; up-weight trend-following.
- **VR < 1 and Z\* significant** → mean-reversion regime; up-weight reversion (e.g. the Bollinger %B short).
- **VR ≈ 1** → random walk; low confidence.
- The **state gate fires when |VR − 1| clears a decisive margin** (≈0.2). A fixed margin is a deliberate simplification of the q-/sample-dependent robust Z\* test — a gating heuristic, not a significance claim.

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.5** — the highest of the regime trio, reflecting its firmest statistical pedigree. There is no directional t-stat to report (it classifies regime, it does not forecast direction). Among the three regime tools it is **medium-high** — it is the best-replicated, and it is the only one with a built-in test of its own significance.

## Recommended Combinations

- **Variance Ratio + Hurst + Regression R²**: the regime lens. VR carries the most weight when the three agree; a significant Z\* corroborating H and R² is a confident regime read.
- **Variance Ratio + a directional event**: let VR decide whether to trust a trend-continuation or a mean-reversion event; e.g. only take the daily %B short when VR < 1 (or near 1), not in a strong trend regime.

## Caveats

- **q-dependence**: VR depends on the chosen horizon q — scan a grid rather than trusting a single q.
- Use the **heteroskedasticity-robust Z\***; the homoskedastic version over-rejects under real-world volatility clustering.
- **Rejection of the random walk is not a direction** — VR > 1 says "trending," but you still need slope sign to know which way. The gate's fixed margin is a heuristic, not the formal test.
